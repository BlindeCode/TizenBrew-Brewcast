import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";


export default [
  {files: ["**/*.{js,mjs,cjs,ts}"]},
  {languageOptions: { globals: globals.node }},
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Buffer's lowercase `Uint` spellings only exist since Node 12.19/14.9; TV runtimes are
    // older. Only the LE/BE forms: FlatBuffers' own ByteBuffer has readUint8, readUint32 etc.
    rules: {
      "no-restricted-properties": ["error",
        ...["readUint16LE", "readUint16BE", "writeUint16LE", "writeUint16BE",
          "readUint32LE", "readUint32BE", "writeUint32LE", "writeUint32BE", "readUintLE", "readUintBE",
          "writeUintLE", "writeUintBE", "readBigUint64LE", "readBigUint64BE", "writeBigUint64LE", "writeBigUint64BE"]
          .map((property) => ({ property, message: "Use the `UInt` spelling: this one is missing on older Node versions." })),
      ],
    },
  },
];