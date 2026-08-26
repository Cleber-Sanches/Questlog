// Parser de Binary VDF (KeyValues binário) usado pela Steam em appcache/stats/*.bin
const TYPE = {
    NONE: 0x00,
    STRING: 0x01,
    INT32: 0x02,
    FLOAT32: 0x03,
    POINTER: 0x04,
    WIDESTRING: 0x05,
    COLOR: 0x06,
    UINT64: 0x07,
    END: 0x08,
    INT64: 0x0A,
    END_ALT: 0x0B,
};

function parse(buf) {
    let offset = 0;

    function readCString() {
        const start = offset;
        while (buf[offset] !== 0) offset++;
        const str = buf.toString("utf8", start, offset);
        offset++;
        return str;
    }

    function readObject() {
        const obj = {};
        while (true) {
            if (offset >= buf.length) return obj;
            const type = buf[offset++];
            if (type === TYPE.END || type === TYPE.END_ALT) {
                return obj;
            }
            const key = readCString();
            let value;
            switch (type) {
                case TYPE.NONE:
                    value = readObject();
                    break;
                case TYPE.STRING:
                    value = readCString();
                    break;
                case TYPE.INT32:
                    value = buf.readInt32LE(offset);
                    offset += 4;
                    break;
                case TYPE.FLOAT32:
                    value = buf.readFloatLE(offset);
                    offset += 4;
                    break;
                case TYPE.POINTER:
                    value = buf.readUInt32LE(offset);
                    offset += 4;
                    break;
                case TYPE.COLOR:
                    value = buf.readUInt32LE(offset);
                    offset += 4;
                    break;
                case TYPE.UINT64:
                    value = buf.readBigUInt64LE(offset);
                    offset += 8;
                    break;
                case TYPE.INT64:
                    value = buf.readBigInt64LE(offset);
                    offset += 8;
                    break;
                default:
                    throw new Error(`Tipo desconhecido 0x${type.toString(16)} no offset ${offset - 1}`);
            }
            obj[key] = value;
        }
    }

    return readObject();
}

module.exports = { parse };
