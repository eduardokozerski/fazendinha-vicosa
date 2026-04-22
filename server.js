import dotenv from "dotenv";
import express from "express";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);
const lip7WebhookUrl =
  process.env.LIP7_WEBHOOK_URL ||
  "https://webhook.lip7.com.br/api/public/flows/webhook/e08bbfbf52ae3f80177c7dbde9e415df3911b451e375993d";
const lip7WebhookApiKey = process.env.LIP7_WEBHOOK_API_KEY || "";

app.use(express.json());

app.use((request, response, next) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }
  next();
});

function normalizePhoneNumber(phoneValue) {
  const digits = String(phoneValue || "").replace(/\D/g, "");
  if (!digits) {
    return "";
  }
  if (digits.startsWith("55")) {
    return digits;
  }
  return `55${digits}`;
}

function toLip7Payload(input) {
  const hasDirectPayload =
    typeof input.phoneNumber === "string" &&
    typeof input.username === "string" &&
    input.variables &&
    typeof input.variables === "object";

  if (hasDirectPayload) {
    return {
      phoneNumber: normalizePhoneNumber(input.phoneNumber),
      username: input.username.trim(),
      variables: {
        cidade: String(input.variables.cidade || "").trim(),
        instagram: String(input.variables.instagram || "").trim(),
        maior_dificuldade: String(input.variables.maior_dificuldade || "").trim(),
      },
    };
  }

  return {
    phoneNumber: normalizePhoneNumber(input.telefone),
    username: String(input.nome || "").trim(),
    variables: {
      cidade: String(input.cidade || "").trim(),
      instagram: String(input.instagram || "Não informado").trim(),
      maior_dificuldade: String(input.maiorDificuldade || "").trim(),
    },
  };
}

function isValidLip7Payload(payload) {
  if (!payload.phoneNumber || payload.phoneNumber.length < 12 || payload.phoneNumber.length > 13) {
    return false;
  }
  if (!payload.username) {
    return false;
  }
  if (!payload.variables.cidade || !payload.variables.maior_dificuldade) {
    return false;
  }
  return true;
}

app.get("/health", (_, response) => {
  response.status(200).json({ ok: true });
});

app.post("/api/diagnostico", async (request, response) => {
  if (!lip7WebhookApiKey) {
    response.status(500).json({ message: "Configuração ausente de LIP7_WEBHOOK_API_KEY." });
    return;
  }

  const payload = toLip7Payload(request.body || {});
  if (!isValidLip7Payload(payload)) {
    response.status(400).json({ message: "Dados inválidos para envio do diagnóstico." });
    return;
  }

  try {
    const lip7Response = await fetch(lip7WebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": lip7WebhookApiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!lip7Response.ok) {
      const errorText = await lip7Response.text();
      response.status(502).json({
        message: "Falha ao enviar dados para a Lip7.",
        details: errorText || `status ${lip7Response.status}`,
      });
      return;
    }

    response.status(200).json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro inesperado ao enviar diagnóstico.";
    response.status(502).json({ message: errorMessage });
  }
});

app.listen(port, () => {
  console.log(`API proxy ativa em http://localhost:${port}`);
});
