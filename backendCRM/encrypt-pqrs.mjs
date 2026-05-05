import { encriptar } from "./src/utils/crypto.js";
const plain = process.argv[2] || "";
if (!plain) {
  console.error("Uso: node script.mjs \"mi_clave\"");
  process.exit(1);
}
console.log(encriptar(plain));
