"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyActiveUserToken = verifyActiveUserToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const accounts_1 = require("./accounts");
function verifyActiveUserToken(token, secret) {
    const payload = jsonwebtoken_1.default.verify(token, secret);
    const userId = String(payload?.sub || '');
    if (!userId) {
        throw new Error('invalid token');
    }
    (0, accounts_1.ensureAccount)(userId);
    if ((0, accounts_1.isAccountDisabled)(userId)) {
        throw new Error('account disabled');
    }
    return payload;
}
