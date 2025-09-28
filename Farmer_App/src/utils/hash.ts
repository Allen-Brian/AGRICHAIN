import * as Crypto from 'expo-crypto';

export async function generateHash(record: object): Promise<string> {
  const json = JSON.stringify(record);
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    json
  );
  return digest;
}
