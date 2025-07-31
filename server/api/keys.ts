import fs from 'fs';
import path from 'path';
import { defineEventHandler } from 'h3';

export default defineEventHandler(async (event) => {
  try {
    const publicKeyPath = path.join(process.cwd(), 'keys', 'public_key.pem');
    
    if (!fs.existsSync(publicKeyPath)) {
      return { error: 'Public key not found' };
    }
    
    const publicKey = fs.readFileSync(publicKeyPath, 'utf-8');
    return { publicKey };
  } catch (error) {
    return { error: 'Failed to load public key' };
  }
});