export function parseCookie(header: string | undefined, name: string): string | undefined {
  if (!header) {
    return undefined;
  }
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    if (trimmed.slice(0, eq) === name) {
      return decodeURIComponent(trimmed.slice(eq + 1));
    }
  }
  return undefined;
}

export function kitchenRoomName(branchId: string): string {
  return `kitchen:${branchId}`;
}

export function parseKitchenRoom(room: string): string | null {
  const prefix = "kitchen:";
  if (!room.startsWith(prefix)) {
    return null;
  }
  const branchId = room.slice(prefix.length).trim();
  return branchId.length > 0 ? branchId : null;
}

export function canJoinKitchenRoom(input: {
  allowedBranchIds: string[] | null;
  branchId: string;
}): boolean {
  if (!input.allowedBranchIds) {
    return true;
  }
  return input.allowedBranchIds.includes(input.branchId);
}
