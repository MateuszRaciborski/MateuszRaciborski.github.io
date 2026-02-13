// js/ai/def_policy.js
//import * as ort from "onnxruntime-web";

// js/ai/def_policy.js


let session = null;

export async function initSession(modelUrl = "/js/ai/def_policy_single.onnx") {
  if (session) return;
  session = await ort.InferenceSession.create(modelUrl, {
    executionProviders: ['wasm']
  });
}


/**
 * @returns Float32Array logits (74)
 */
export async function runLogits(obs_global, unit_feat, action_mask) {
  if (!session) throw new Error("ONNX session not initialized");

  const feeds = {
    obs_global: new ort.Tensor("float32", obs_global, [1, 1634]),
    unit_feat:  new ort.Tensor("float32", unit_feat,  [1, 3]),
    action_mask:       new ort.Tensor("bool",    action_mask,       [1, 64]),
  };

  const out = await session.run(feeds);
  return out.logits.data; // Float32Array length 74
}