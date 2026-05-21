const fs = require('fs');
const crypto = require('crypto');
const forge = require('node-forge');

function generateSecurePassword(length = 20) {
  // Use a clean alphanumeric set so there are no special char copy-paste issues on phone
  return crypto.randomBytes(length).toString('hex').slice(0, length);
}

const keystorePath = 'release.keystore';
const infoPath = 'keystore-info.txt';
const jsonDataPath = 'src/keystore-data.json';

try {
  console.log('--- Keystore Generation Script Started (using node-forge) ---');

  let keystorePassword, keyPassword, alias;

  if (fs.existsSync(keystorePath)) {
    console.log('Keystore file already exists! Overwriting to keep synced in developer view.');
    fs.unlinkSync(keystorePath);
  }

  keystorePassword = generateSecurePassword(16);
  keyPassword = keystorePassword; // Keep same for compatibility / simplicity in signing
  alias = 'charging_alarm_pro_key';

  console.log('Generating RSA 2048 key pair...');
  const keys = forge.pki.rsa.generateKeyPair(2048);

  console.log('Creating self-signed certificate...');
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01' + crypto.randomBytes(8).toString('hex'); // unique serial
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 30); // 30 years validity

  const attrs = [
    { name: 'commonName', value: 'Charging Alarm Pro' },
    { name: 'organizationName', value: 'Charging Alarm Pro' },
    { name: 'countryName', value: 'IN' }
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);

  console.log('Signing certificate...');
  cert.sign(keys.privateKey, forge.md.sha256.create());

  console.log('Packaging into PKCS#12 store using toPkcs12Asn1...');
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], keystorePassword, {
    generateLocalKeyId: true,
    friendlyName: alias,
    algorithm: '3des' // Compatible algorithm for standard Java keystore, works flawlessly in Android
  });

  // Convert ASN.1 to binary DER string
  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();

  // Convert binary string to standard NodeJS Buffer
  const p12Buffer = Buffer.from(p12Der, 'binary');

  // Write file to filesystem
  fs.writeFileSync(keystorePath, p12Buffer);
  console.log('Keystore file (.keystore) generated successfully!');

  // Conversion of newly generated keystore to Base64
  const base64Keystore = p12Buffer.toString('base64');

  // Write details to keystore-info.txt
  const infoContent = `ALIAS=${alias}
KEYSTORE_PASSWORD=${keystorePassword}
KEY_PASSWORD=${keyPassword}
SIGNING_KEY=${base64Keystore}`;

  fs.writeFileSync(infoPath, infoContent, 'utf8');
  console.log('keystore-info.txt updated!');

  // Save the JSON as well
  const jsonContent = JSON.stringify({
    ALIAS: alias,
    KEYSTORE_PASSWORD: keystorePassword,
    KEY_PASSWORD: keyPassword,
    SIGNING_KEY: base64Keystore
  }, null, 2);
  fs.writeFileSync(jsonDataPath, jsonContent, 'utf8');
  console.log('src/keystore-data.json updated for app view!');

} catch (error) {
  console.error('Error with forge during keystore generation:', error);
}
