import React from "react";

type TestStatus = "pending" | "success" | "failure";
type Step = "connectivity" | "camera" | "mic" | "done";

type Props = {
  busy: boolean;
  results: any;
  setResults: (fn: (prev: any) => any) => void;
  startCamera: () => void;
  stopCamera: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  renderStatus?: (status?: TestStatus) => React.ReactNode;
  setStep: (step: Step) => void;
};

export function CameraTest({
  busy, results, startCamera, stopCamera, videoRef, renderStatus, setStep
}: Props) {
  return (
    <div>
      <h2 className="font-semibold mb-2">Teste de câmera</h2>
      <p className="text-sm mb-4">Permita acesso à câmera para ver o preview.</p>
      <div className="flex flex-col md:flex-row md:gap-4">
        <div className="md:w-1/2">
          <div className="bg-black rounded mb-2 relative">
            <video
              ref={videoRef}
              className="w-full h-64 object-contain rounded"
              autoPlay
              playsInline
            />
            {results.camera && (
              <div className="absolute top-2 right-2">
                {renderStatus? renderStatus(results.camera.status) : null}
              </div>
            )}
          </div>
          <div className="text-sm text-gray-700 mb-2 space-y-1">
            <p>
              <span className="font-semibold">Resolução:</span>{" "}
              {results.camera?.resolution?.width ?? "—"} x{" "}
              {results.camera?.resolution?.height ?? "—"}
            </p>
            <p>
              <span className="font-semibold">Dispositivo:</span>{" "}
              {results.camera?.deviceLabel ?? "—"}
            </p>
            <p className="flex items-center gap-2">
              <span className="font-semibold">Rostos detectados:</span>
              {results.faces && results.faces > 0 ? (
                <span className="px-2 py-1 rounded bg-green-100 text-green-700 text-xs font-medium">
                  {results.faces} rosto(s) encontrado(s)
                </span>
              ) : (
                <span className="px-2 py-1 rounded bg-red-100 text-red-700 text-xs font-medium">
                  Nenhum rosto
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              disabled={busy}
              onClick={startCamera}
              className="px-3 py-2 rounded bg-verde-escuro text-white w-full sm:w-auto"
            >
              Ativar câmera
            </button>
            <button
              onClick={stopCamera}
              className="px-3 py-2 rounded border w-full sm:w-auto"
            >
              Parar
            </button>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-between gap-2">
        <button
          onClick={() => setStep("connectivity")}
          className="px-4 py-2 rounded border w-full sm:w-auto"
        >
          Voltar
        </button>
        <button
          onClick={() => setStep("mic")}
          className="px-4 py-2 rounded bg-quase-branco border w-full sm:w-auto"
        >
          Próximo: Microfone
        </button>
      </div>
    </div>
  );
}