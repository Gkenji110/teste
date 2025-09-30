export default function handler(req, res) {
  // Permite CORS para qualquer origem (ou restrinja para seu domínio)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    // Apenas para medir o tempo de upload, não precisa salvar nada
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).end(); // Method Not Allowed
}