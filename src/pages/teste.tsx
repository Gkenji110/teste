import React, { useEffect, useRef, useState } from "react";
import "../index.css";
import * as faceapi from "face-api.js";
import NetworkTest from '../component/networktest';
import { MicTest } from "../component/mictest";
import { CameraTest } from "../component/cameratest";

type MicDevice = {
  deviceId: string;
  label: string;
};

type TestStatus = "pending" | "success" | "failure";

type Results = {
  connectivity?: {
    pingMs?: number;
    downloadKbps?: number;
    downloadBytes?: number;
    details?: string;
    status?: TestStatus;
  };
  camera?: {
    supported: boolean;
    snapshotDataUrl?: string;
    resolution?: { width?: number; height?: number };
    deviceLabel?: string;
    status?: TestStatus;
  };
  mic?: {
    supported: boolean;
    rms?: number; // approx level
    recordedBlobSize?: number;
    deviceLabel?: string;
    status?: TestStatus;
  };
  faces?: number;
  timestamp: string;
};

export function Teste() {
  const [step, setStep] = useState<"connectivity" | "camera" | "mic" | "done">("connectivity");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Results>({ timestamp: new Date().toISOString() });

  // Camera refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentStreamRef = useRef<MediaStream | null>(null);

  // --- MICROPHONE STATE ---
  const [micDevices, setMicDevices] = useState<MicDevice[]>([]);
  const [selectedMic, setSelectedMic] = useState<string>("default");
  const [listening, setListening] = useState(false);
  const [level, setLevel] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [permissionAsked, setPermissionAsked] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<Uint8Array | null>(null);
  const rafRef = useRef<number | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);




  // --- CAMERA TEST ---
  async function startCamera() {
    setBusy(true);
    try {
      if (!("mediaDevices" in navigator) || !navigator.mediaDevices.getUserMedia) {
        setResults(prev => ({ ...prev, camera: { supported: false, status: "failure" } }));
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } });
      currentStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadeddata = () => {
          initFaceDetection();
        };
        await videoRef.current.play().catch(() => { });
      }
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      setResults(prev => ({
        ...prev,
        camera: {
          supported: true,
          resolution: { width: settings.width, height: settings.height },
          deviceLabel: track.label || undefined,
          status: "success",
        },
      }));
    } catch {
      setResults(prev => ({ ...prev, camera: { supported: false, status: "failure" } }));
    } finally {
      setBusy(false);
    }
  }

  function stopCamera() {
    const s = currentStreamRef.current;
    if (s) {
      s.getTracks().forEach(t => t.stop());
      currentStreamRef.current = null;
    }
    if (videoRef.current) {
      try { videoRef.current.pause(); videoRef.current.srcObject = null; } catch { }
    }
  }
  const detectionIntervalRef = useRef<number | null>(null);

  async function initFaceDetection() {
    await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
    detectionIntervalRef.current = setInterval(async () => {
      if (videoRef.current) {
        const faces = await faceapi.detectAllFaces(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 224 })
        );
        setResults(prev => ({
          ...prev,
          faces: faces.length
        }));
      }
    }, 200);
  }

  function stopDetection() {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
  }

  // --- MICROPHONE FUNCTIONS ---

  const maxLevelRef = useRef(0);

  async function enumerateMics() {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const mics = list
        .filter(d => d.kind === "audioinput")
        .map(d => ({ deviceId: d.deviceId, label: d.label || "Microfone (não nomeado)" }));
      setMicDevices(mics);
    } catch (err: any) {
      setMicError(String(err?.message || err));
    }
  }

  async function requestPermissionAndList() {
    setMicError(null);
    try {
      setPermissionAsked(true);
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = s;
      await enumerateMics();
      s.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    } catch (err: any) {
      setMicError("Permissão para microfone negada ou erro: " + (err?.message ?? err));
    } finally {
      await enumerateMics();
    }
  }

  async function startListening() {
    setMicError(null);
    try {
      if (listening) stopListening();

      const constraints: MediaStreamConstraints =
        selectedMic && selectedMic !== "default"
          ? { audio: { deviceId: { exact: selectedMic } } }
          : { audio: true };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // --- Preparar análise de áudio ---
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      const audioCtx: AudioContext = new AC();
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;
      dataRef.current = new Uint8Array(analyser.frequencyBinCount);

      recordedChunksRef.current = [];
      maxLevelRef.current = 0;

      // --- Gravador ---
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordedChunksRef.current.push(ev.data);
      };
      recorder.start();

      setListening(true);
      rafRef.current = requestAnimationFrame(drawLevel);

      // --- Parar após 5 segundos ---
      setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, 5000);

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });

        const audioUrl = URL.createObjectURL(blob);


        const status: TestStatus = maxLevelRef.current >= 0.01 ? "success" : "failure";

        setResults((prev) => ({
          ...prev,
          mic: {
            ...(prev.mic || {}),
            rms: maxLevelRef.current,
            recordedBlobSize: blob.size,
            audioUrl,            // <- adiciona URL para reprodução
            supported: true,
            deviceLabel: micDevices.find((d) => d.deviceId === selectedMic)?.label,
            status,
          },
        }));

        // Para não deixar o microfone aberto
        stream.getTracks().forEach((t) => t.stop());
      };
    } catch (err: any) {
      setMicError("Erro ao iniciar captura: " + (err?.message ?? err));
      setListening(false);
    }
  }


  function stopListening() {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch { } audioCtxRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    analyserRef.current = null;
    dataRef.current = null;
    mediaRecorderRef.current = null;
    setListening(false);
    setLevel(0);
  }


  function drawLevel() {
    const analyser = analyserRef.current;
    const data = dataRef.current;
    if (!analyser || !data) { rafRef.current = requestAnimationFrame(drawLevel); return; }
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / data.length);
    setLevel(rms);

    // Atualiza o nível máximo
    if (rms > maxLevelRef.current) maxLevelRef.current = rms;

    rafRef.current = requestAnimationFrame(drawLevel);
  }

  useEffect(() => {
    enumerateMics();
    return () => {
      stopCamera();
      stopListening();
    };
  }, []);

  useEffect(() => {
    if (!listening) return;
    (async () => {
      stopListening();
      await new Promise(r => setTimeout(r, 150));
      startListening();
    })();
  }, [selectedMic]);

  function downloadResults() {
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `connectivity-results-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- RENDER ---
  const pct = Math.min(level * 300, 100);

  const renderStatus = (status?: TestStatus) => {
    if (!status || status === "pending") return <span className="text-gray-400 text-xl">⏳</span>;
    if (status === "success") return <span className="text-green-600 text-xl">✅</span>;
    return <span className="text-red-600 text-xl">❌</span>;
  };

  return (
    <>

      <div className="min-h-screen flex flex-col items-center justify-start bg-bg-clarinho p-8">
        <div className="w-full max-w-4xl">
          <h1 className="text-2xl font-bold text-roxo-escuro mb-4">
            Teste de conectividade e periféricos
          </h1>
          <p className="text-sm text-texto-escuro mb-6">
            Fluxo guiado: execute cada teste em sequência. Permita acesso à
            câmera/microfone quando perguntado.
          </p>

          <div className="bg-white rounded-xl shadow p-6">
            {/* NAV DE STEPS */}
            <div className="flex flex-wrap items-center gap-2 md:gap-4 mb-4">
              <button
                className={`px-3 py-1 rounded w-full sm:w-auto ${step === "connectivity"
                    ? "bg-verde-escuro text-white"
                    : "bg-quase-branco"
                  }`}
                onClick={() => setStep("connectivity")}
              >
                1. Conectividade
              </button>
              <button
                className={`px-3 py-1 rounded w-full sm:w-auto ${step === "camera"
                    ? "bg-verde-escuro text-white"
                    : "bg-quase-branco"
                  }`}
                onClick={() => setStep("camera")}
              >
                2. Câmera
              </button>
              <button
                className={`px-3 py-1 rounded w-full sm:w-auto ${step === "mic"
                    ? "bg-verde-escuro text-white"
                    : "bg-quase-branco"
                  }`}
                onClick={() => setStep("mic")}
              >
                3. Microfone
              </button>
              <div className="w-full sm:ml-auto text-sm text-gray-500 mt-2 sm:mt-0">
                Status: {busy ? "Executando..." : "Pronto"}
              </div>
            </div>

            {step === "connectivity" && (
              <div>
                <NetworkTest
                  onFinish={({ downloadMbps, uploadMbps, prepDuration, status }) => {
                    setResults((prev) => ({
                      ...prev,
                      connectivity: {
                        downloadKbps: downloadMbps ? Math.round(downloadMbps * 1000 / 8) : undefined,
                        details: `Download: ${downloadMbps ?? '-'} Mbps, Upload: ${uploadMbps ?? '-'} Mbps, Prep: ${prepDuration?.toFixed(2) ?? '-'}s`,
                        status: status ?? ((downloadMbps && downloadMbps >= 25 && uploadMbps && uploadMbps >= 3) ? "success" : "failure"),
                      },
                    }));
                    setStep("camera");
                  }}
                />
              </div>
            )}

            {step === "camera" && (
  <CameraTest
    busy={busy}
    results={results}
    setResults={setResults}
    startCamera={startCamera}
    stopCamera={stopCamera}
    videoRef={videoRef}
    renderStatus={renderStatus}
    setStep={setStep}
  />
)}

{step === "mic" && (
  <MicTest
    busy={busy}
    micError={micError}
    micDevices={micDevices}
    selectedMic={selectedMic}
    setSelectedMic={setSelectedMic}
    requestPermissionAndList={requestPermissionAndList}
    enumerateMics={enumerateMics}
    listening={listening}
    startListening={startListening}
    stopListening={stopListening}
    results={results}
    renderStatus={renderStatus}
    setStep={setStep}
  />
)}

            {/* --- DONE --- */}
            {step === "done" && (
              <div>
                <h2 className="font-semibold mb-2">Resumo / Resultados</h2>
                <div className="bg-white p-4 rounded shadow space-y-3 text-sm leading-relaxed text-gray-800">

                  {/* Conectividade */}
                  <div>
                    <h3 className="font-semibold text-roxo-escuro">Conectividade</h3>
                    {results.connectivity ? (
                      <p>
                        Latência de <b>{results.connectivity.pingMs} ms</b>, velocidade de
                        download <b>{results.connectivity.downloadKbps} kbps</b> (
                        {results.connectivity.downloadBytes} bytes).
                        Status:{" "}
                        {results.connectivity.status === "success"
                          ? "✅ Conexão estável"
                          : "❌ Problemas detectados"}
                      </p>
                    ) : (
                      <p>Não foi realizado.</p>
                    )}
                  </div>

                  {/* Câmera */}
                  <div>
                    <h3 className="font-semibold text-roxo-escuro">Câmera</h3>
                    {results.camera ? (
                      <p>
                        Dispositivo: <b>{results.camera.deviceLabel ?? "Não identificado"}</b>,
                        resolução <b>{results.camera.resolution?.width} x {results.camera.resolution?.height}</b>.
                        {results.faces && results.faces > 0 ? (
                          <> Foram detectados <b>{results.faces}</b> rosto(s). ✅</>
                        ) : (
                          <> Nenhum rosto detectado. ❌</>
                        )}
                      </p>
                    ) : (
                      <p>Não foi realizado.</p>
                    )}
                  </div>

                  {/* Microfone */}
                  <div>
                    <h3 className="font-semibold text-roxo-escuro">Microfone</h3>
                    {results.mic ? (
                      <p>
                        Dispositivo: <b>{results.mic.deviceLabel ?? "Não identificado"}</b>.{" "}
                        Última gravação com tamanho de <b>{results.mic.recordedBlobSize} bytes</b>.
                        Nível de áudio máximo detectado:{" "}
                        <b>{(results.mic.rms ?? 0).toFixed(3)}</b>.{" "}
                        {results.mic.status === "success"
                          ? "✅ Captação de áudio bem-sucedida."
                          : "❌ Não foi detectado áudio."}
                      </p>
                    ) : (
                      <p>Não foi realizado.</p>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      onClick={downloadResults}
                      className="px-3 py-2 rounded bg-verde-escuro text-white w-full sm:w-auto"
                    >
                      Baixar relatório (JSON)
                    </button>
                    <button
                      onClick={() => {
                        setStep("connectivity");
                        setResults({ timestamp: new Date().toISOString() });
                      }}
                      className="px-3 py-2 rounded border w-full sm:w-auto"
                    >
                      Reiniciar testes
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );

}