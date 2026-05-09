// AUTO-GENERATED. DO NOT EDIT.
export const CONTRACT_VERSION = "1.2.0";
export const SCHEMA_SHA256 = "c338b55c649254a05ffffe4457eda1dcbae1b84e9814700be4bb7316164eb009";
export const REGISTRY_VERSION = 1;
export const CODEC_ID = "cbor-canon-v1";
export const OPS = [
  { kind: "QUERY", name: "capabilities", op_id: 847711509, result_type: "Capability", args: [] },
  { kind: "QUERY", name: "deliveryObservations", op_id: 3925137921, result_type: "DeliveryObservation", args: [{"name":"receiptId","type":"ID","required":false,"list":false},{"name":"headId","type":"String","required":false,"list":false},{"name":"frameIndex","type":"Int","required":false,"list":false}] },
  { kind: "QUERY", name: "receipts", op_id: 4277194034, result_type: "Receipt", args: [{"name":"headId","type":"String","required":false,"list":false},{"name":"frameIndex","type":"Int","required":false,"list":false}] },
  { kind: "QUERY", name: "witnesses", op_id: 3804088302, result_type: "Witness", args: [{"name":"receiptId","type":"ID","required":true,"list":false}] },
];
export const findOpId = (kind, name) => { const op = OPS.find(o => o.kind === kind && o.name === name); if (!op) throw new Error(`Unknown op: ${kind}:${name}`); return op.op_id; };