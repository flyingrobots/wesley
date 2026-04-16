// AUTO-GENERATED. DO NOT EDIT.
import { z } from "zod";
export const CapabilityScopeEnum = z.enum(["READ","WRITE","CONTROL","OBSERVE","JUDGMENT"]);
export const DeliveryOutcomeEnum = z.enum(["DELIVERED","SUPPRESSED","FAILED","SKIPPED"]);
export const ExecutionModeEnum = z.enum(["LIVE","REPLAY","DEBUG"]);
export const WitnessKindEnum = z.enum(["FOOTPRINT","COUNTERFACTUAL","REINTEGRATION","PRECONDITION"]);
export const CapabilitySchema = z.object({
  capabilityId: z.string(),
  name: z.string(),
  scope: CapabilityScopeEnum,
  resource: z.string(),
  description: z.string().optional()
}).strict();
export const ContinuumReceiptFamilyInvariantsSchema = z.object({
  _placeholder: z.boolean().optional()
}).strict();
export const DeliveryObservationSchema = z.object({
  observationId: z.string(),
  receiptId: z.string(),
  emissionId: z.string(),
  headId: z.string(),
  frameIndex: z.number().int(),
  sinkId: z.string(),
  outcome: DeliveryOutcomeEnum,
  reason: z.string(),
  observerId: z.string().optional(),
  executionMode: ExecutionModeEnum,
  summary: z.string()
}).strict();
export const ReceiptSchema = z.object({
  receiptId: z.string(),
  headId: z.string(),
  frameIndex: z.number().int(),
  laneId: z.string(),
  writerId: z.string().optional(),
  inputTick: z.number().int(),
  outputTick: z.number().int(),
  admittedRewriteCount: z.number().int(),
  rejectedRewriteCount: z.number().int(),
  counterfactualCount: z.number().int(),
  digest: z.any(),
  summary: z.string()
}).strict();
export const WitnessSchema = z.object({
  witnessId: z.string(),
  receiptId: z.string(),
  kind: WitnessKindEnum,
  residueHash: z.any(),
  footprint: z.string().optional(),
  summary: z.string()
}).strict();
export const CapabilitiesVarsSchema = z.object({}).strict();
export const CapabilitiesResultSchema = z.array(CapabilitySchema);
export const DeliveryObservationsVarsSchema = z.object({
  receiptId: z.string().optional(),
  headId: z.string().optional(),
  frameIndex: z.number().int().optional()
}).strict();
export const DeliveryObservationsResultSchema = z.array(DeliveryObservationSchema);
export const ReceiptsVarsSchema = z.object({
  headId: z.string().optional(),
  frameIndex: z.number().int().optional()
}).strict();
export const ReceiptsResultSchema = z.array(ReceiptSchema);
export const WitnessesVarsSchema = z.object({
  receiptId: z.string()
}).strict();
export const WitnessesResultSchema = z.array(WitnessSchema);
export const OP_SCHEMAS = {
  "capabilities": { vars: CapabilitiesVarsSchema, result: CapabilitiesResultSchema },
  "deliveryObservations": { vars: DeliveryObservationsVarsSchema, result: DeliveryObservationsResultSchema },
  "receipts": { vars: ReceiptsVarsSchema, result: ReceiptsResultSchema },
  "witnesses": { vars: WitnessesVarsSchema, result: WitnessesResultSchema }
};