import React from "react";

type TestStatus = "pending" | "success" | "failure";

type MicDevice = {
  deviceId: string;
  label: string;
};

type Props = {
  busy: boolean;
  micError: string | null;
  micDevices: MicDevice[];
  selectedMic: string;
  setSelectedMic: (id: string) => void;
  requestPermissionAndList: () => void;
  enumerateMics: () => void;
  listening: boolean;
  startListening: () => void;
  stopListening: () => void;
  results: any;
  renderStatus?: (status?: TestStatus) => React.ReactNode;
  setStep: (step: "connectivity" | "camera" | "mic" | "done") => void;
};

export function MicTest({
  busy, micError, micDevices, selectedMic, setSelectedMic,
  requestPermissionAndList, enumerateMics, listening, startListening, stopListening,
  results, renderStatus, setStep
}: Props) {
  return (
    <div>
      <h2 className="font-semibold mb-2">Teste de microfone</h2>
      <p className="text-sm mb-4">
        Permita acesso ao microfone e fale. Vamos medir nível RMS e
        gravar ~3s para demonstrar captura.
      </p>
      {micError && (
        <div className="mb-3 text-sm text-red-600">{micError}</div>
      )}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Microfone
        </label>
        <div className="flex flex-wrap gap-2">
          <select
            className="flex-1 border rounded p-2 min-w-[150px]"
            value={selectedMic}
            onChange={(e) => setSelectedMic(e.target.value)}
          >
            <option value="default">Padrão do sistema</option>
            {micDevices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>
          <button
            onClick={requestPermissionAndList}
            className="px-3 py-2 rounded border text-sm w-full sm:w-auto"
          >
            Listar / Permitir
          </button>
          <button
            onClick={enumerateMics}
            className="px-3 py-2 rounded border text-sm w-full sm:w-auto"
            title="Atualiza lista (não pede permissão)"
          >
            Atualizar
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Dica: clique em “Listar / Permitir” para que o navegador
          solicite permissão e mostre os nomes dos dispositivos.
        </p>
      </div>
      <div className="flex flex-wrap gap-3 items-center mb-3">
        {!listening ? (
          <button
            disabled={busy}
            onClick={startListening}
            className="px-3 py-2 rounded bg-verde-escuro text-white w-full sm:w-auto"
          >
            Iniciar (usar selecionado)
          </button>
        ) : (
          <button
            onClick={stopListening}
            className="px-3 py-2 rounded border w-full sm:w-auto"
          >
            Parar
          </button>
        )}
      </div>
      <div className="bg-bg-escurinho p-3 rounded">
        <p>
          Microfone disponível: {results.mic?.supported ? "Sim" : "—"}{" "}
          {renderStatus ? renderStatus(results.mic?.status) : null}
        </p>
      </div>
      <div className="mt-4 flex flex-wrap justify-between gap-2">
        <button
          onClick={() => setStep("camera")}
          className="px-4 py-2 rounded border w-full sm:w-auto"
        >
          Voltar
        </button>
        <button
          onClick={() => setStep("done")}
          className="px-4 py-2 rounded bg-quase-branco border w-full sm:w-auto"
        >
          Ver resultados
        </button>
      </div>
    </div>
  );
}