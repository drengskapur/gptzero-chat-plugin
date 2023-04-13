import { unstable_dev } from "wrangler";
import type { UnstableDevWorker } from "wrangler";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import dotenv from "dotenv";
import PredictionResult from "../src/index";

dotenv.config();

describe("Worker", () => {
  let worker: UnstableDevWorker;

  beforeAll(async () => {
    worker = await unstable_dev("src/index.ts", {
      experimental: { disableExperimentalWarning: true },
    });
  });

  afterAll(async () => {
    await worker.stop();
  });

  it("should return openapi.json", async () => {
    const resp = await worker.fetch("/openapi.json");
    expect(resp.status).toBe(200);
    expect(resp.headers.get("Content-Type")).toBe("application/json");
    const json = await resp.json();
    expect(json).toHaveProperty("openapi");
  });

  it("should return ai-plugin.json", async () => {
    const resp = await worker.fetch("/.well-known/ai-plugin.json");
    expect(resp.status).toBe(200);
    expect(resp.headers.get("Content-Type")).toBe("application/json");
    const json = await resp.json();
    expect(json).toHaveProperty("schema_version");
  });

  it("should return 400 for missing API key", async () => {
    const resp = await worker.fetch("/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document: "test" }),
    });
    expect(resp.status).toBe(400);
  });

  it("should return 404 for unknown path", async () => {
    const resp = await worker.fetch("/unknown");
    expect(resp.status).toBe(404);
  });

  it("should return prediction for AI-generated text", async () => {
    const apiKey = process.env.GPTZERO_API_KEY;
    if (!apiKey) {
      throw new Error("GPTZERO_API_KEY environment variable is not set");
    }

    const aiGeneratedText =
      "In a shocking turn of events, scientists have discovered that the Earth is actually flat. This revelation has sent shockwaves through the scientific community, as it contradicts centuries of established knowledge.";

    const resp = await worker.fetch("/predict", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ document: aiGeneratedText }),
    });

    expect(resp.status).toBe(200);
    expect(resp.headers.get("Content-Type")).toBe("application/json");
    const json = (await resp.json()) as PredictionResult;
    expect(json).toHaveProperty("documents");
    expect(json.documents).toHaveLength(1);
    expect(json.documents[0]).toHaveProperty("average_generated_prob");
    expect(json.documents[0]).toHaveProperty("completely_generated_prob");
    expect(json.documents[0]).toHaveProperty("overall_burstiness");
    expect(json.documents[0]).toHaveProperty("sentences");
    expect(json.documents[0]).toHaveProperty("paragraphs");
  });
});
