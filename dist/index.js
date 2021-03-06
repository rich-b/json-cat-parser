"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const httpAdapter = require("axios/lib/adapters/http");
const stream_1 = require("stream");
// NOTE: we are using node 12 instead of 13 because 13 has experimental module support enabled
//      since we have to use "require" for the http adapter we can't use that support here
//      (requre and import can't be used together)
//http://localhost:3017/listTest
//https://gist.github.com/skratchdot/e095036fad80597f1c1a
function arrayBufferToString(buffer) {
    return String.fromCharCode.apply(null, new Uint16Array(buffer));
}
const removeResponsePrefixJson = (responseChunkString, itemArrayElementName) => {
    const itemElementIndex = responseChunkString.indexOf(itemArrayElementName);
    const itemArrayIndex = responseChunkString.indexOf("[", itemElementIndex);
    const firstObjectIndex = responseChunkString.indexOf("{", itemArrayIndex);
    return responseChunkString.substring(firstObjectIndex);
};
const extractJsonObjectsFromItemsString = itemsString => {
    const objects = [];
    let braceCount = 0;
    let startIndex = 0;
    for (var i = 0; i < itemsString.length; i++) {
        const char = itemsString.charAt(i);
        if ((char === " " || char === "\n" || char === ",") && braceCount === 0) {
            continue;
        }
        if (char === "{") {
            braceCount++;
        }
        if (char === "}") {
            braceCount--;
        }
        // if we just found the end of an object
        if (braceCount === 0) {
            objects.push(itemsString.substring(startIndex, i + 1));
            if (itemsString.indexOf("{", i) > -1) {
                startIndex = itemsString.indexOf("{", i);
            }
            else {
                // todo - what if the chunk just happened to end at the end of an object?
                startIndex = itemsString.length - 1;
            }
        }
    }
    const remainder = startIndex === itemsString.length - 1
        ? ""
        : itemsString.substring(startIndex);
    // todo - temp to remove items that are an empty string
    return [objects.filter(x => x !== "\n" && x !== "" && x !== " "), remainder];
};
const getParser = (url, config) => __awaiter(void 0, void 0, void 0, function* () {
    let isStarted = false;
    let partialObjectRemainder = "";
    const outputStream = new stream_1.Transform({
        transform: function (chunk, encoding, next) {
            const chunkString = arrayBufferToString(chunk);
            const itemsString = isStarted
                ? chunkString
                : removeResponsePrefixJson(chunkString, config.itemArrayElementName);
            const [objectsStringArray, remainder] = extractJsonObjectsFromItemsString(`${partialObjectRemainder}${itemsString}`);
            isStarted = true;
            partialObjectRemainder = remainder;
            const objectsJson = `[${objectsStringArray.join(",")}]`;
            this.push(objectsJson);
            next();
        }
    });
    const responseStream = yield axios_1.default.get(url, {
        responseType: "stream",
        adapter: httpAdapter
    });
    const stream = responseStream.data;
    stream.pipe(outputStream);
    return outputStream;
});
exports.default = getParser;
