let emitter:
  | { to: (room: string) => { emit: (event: string, payload: unknown) => void } }
  | undefined;

export function setKitchenEmitter(value: typeof emitter) {
  emitter = value;
}

export function kitchenRoom(branchId: string): string {
  return `kitchen:${branchId}`;
}

export function emitKitchen(branchId: string, event: string, payload: unknown): void {
  emitter?.to(kitchenRoom(branchId)).emit(event, payload);
}
