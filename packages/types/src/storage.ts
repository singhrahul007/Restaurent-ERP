export type PutObjectInput = {
  key: string;
  body: Uint8Array;
  contentType?: string;
};

export type PresignGetInput = {
  key: string;
  expiresInSeconds: number;
};

export type PresignPutInput = {
  key: string;
  expiresInSeconds: number;
  contentType?: string;
};

export type ObjectStorage = {
  putObject(input: PutObjectInput): Promise<void>;
  getPresignedGetUrl(input: PresignGetInput): Promise<string>;
  getPresignedPutUrl(input: PresignPutInput): Promise<string>;
};
