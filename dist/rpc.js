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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.call = exports.getChainId = exports.setChainIdOverride = exports.signData = exports.send = exports.isUserRejectedError = exports.isCoinbaseProvider = void 0;
const randomId = () => Math.floor(Math.random() * 10000000000);
/** Coinbase Wallet（尤其内置 dapp 浏览器）对 typedData 字符串不兼容，需要传对象 */
exports.isCoinbaseProvider = (provider) => {
    const tag = '[isCoinbaseProvider]';
    try {
        const eth = provider || (typeof window !== 'undefined' ? window.ethereum : null);
        const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
        const flags = eth ? {
            isCoinbaseWallet: !!eth.isCoinbaseWallet,
            isCoinbaseBrowser: !!eth.isCoinbaseBrowser,
            isMetaMask: !!eth.isMetaMask,
            isTrust: !!eth.isTrust,
            hasRequest: typeof eth.request === 'function',
            hasSendAsync: typeof eth.sendAsync === 'function',
            providersLen: Array.isArray(eth.providers) ? eth.providers.length : 0,
        } : null;
        if (!eth) {
            console.log(tag, 'result=false', 'reason=no-provider', { ua });
            return false;
        }
        if (eth.isCoinbaseWallet || eth.isCoinbaseBrowser) {
            console.log(tag, 'result=true', 'reason=provider-flag', flags, { ua });
            return true;
        }
        if (Array.isArray(eth.providers)) {
            const hit = eth.providers.find((p) => p && (p.isCoinbaseWallet || p.isCoinbaseBrowser));
            if (hit) {
                console.log(tag, 'result=true', 'reason=providers-array', {
                    hitIsCoinbaseWallet: !!hit.isCoinbaseWallet,
                    hitIsCoinbaseBrowser: !!hit.isCoinbaseBrowser,
                }, flags, { ua });
                return true;
            }
        }
        if (/Coinbase/i.test(ua)) {
            console.log(tag, 'result=true', 'reason=userAgent', flags, { ua });
            return true;
        }
        console.log(tag, 'result=false', 'reason=no-match', flags, { ua });
        return false;
    }
    catch (e) {
        console.warn(tag, 'result=false', 'reason=exception', e);
        return false;
    }
};
/** 用户主动取消签名时禁止再 fallback，否则会立刻再弹一次授权窗 */
exports.isUserRejectedError = (err) => {
    if (!err)
        return false;
    const code = err.code != null ? err.code : (err.error && err.error.code);
    if (code === 4001 || code === 'ACTION_REJECTED' || code === 4100)
        return true;
    const msg = String((err.message || '') + ' ' +
        (err.errMsg || '') + ' ' +
        (err.reason || '') + ' ' +
        (err.error && err.error.message ? err.error.message : '')).toLowerCase();
    return (msg.indexOf('user rejected') !== -1 ||
        msg.indexOf('user denied') !== -1 ||
        msg.indexOf('rejected the request') !== -1 ||
        msg.indexOf('denied transaction') !== -1 ||
        msg.indexOf('user cancelled') !== -1 ||
        msg.indexOf('user canceled') !== -1 ||
        msg.indexOf('cancelled') !== -1 ||
        msg.indexOf('canceled') !== -1 ||
        msg.indexOf('request:fail abort') !== -1);
};
const unwrapProvider = (provider) => provider && (provider.provider && provider.provider.provider
    ? provider.provider.provider
    : (provider.provider || provider));
exports.send = (provider, method, params) => new Promise((resolve, reject) => {
    const payload = {
        id: randomId(),
        method,
        params,
    };
    const callback = (err, result) => {
        if (err) {
            reject(err);
        }
        else if (result.error) {
            console.error(result.error);
            reject(result.error);
        }
        else {
            console.log(`permit callback->result`, result);
            if (result && result.result)
                resolve(result.result);
            else
                resolve(result);
        }
    };
    const _provider = unwrapProvider(provider);
    // 优先 EIP-1193 request（Coinbase / 现代钱包更稳定）
    if (typeof _provider.request === 'function') {
        _provider
            .request({ method, params })
            .then((r) => resolve(r))
            .catch((e) => reject(e));
        return;
    }
    if (_provider.getUncheckedSigner /* ethers provider */) {
        _provider
            .send(method, params)
            .then((r) => resolve(r))
            .catch((e) => reject(e));
    }
    else if (_provider.sendAsync) {
        _provider.sendAsync(payload, callback);
    }
    else {
        _provider.send(payload, callback).catch((error) => {
            if (error.message ===
                "Hardhat Network doesn't support JSON-RPC params sent as an object") {
                _provider
                    .send(method, params)
                    .then((r) => resolve(r))
                    .catch((e) => reject(e));
            }
            else {
                throw error;
            }
        });
    }
});
const splitSignatureToRSV = (signature) => {
    const r = '0x' + signature.substring(2).substring(0, 64);
    const s = '0x' + signature.substring(2).substring(64, 128);
    const v = parseInt(signature.substring(2).substring(128, 130), 16);
    return { r, s, v };
};
const signWithEthers = (signer, fromAddress, typeData) => __awaiter(void 0, void 0, void 0, function* () {
    const signerAddress = yield signer.getAddress();
    if (signerAddress.toLowerCase() !== fromAddress.toLowerCase()) {
        throw new Error('Signer address does not match requested signing address');
    }
    const _a = typeData.types, { EIP712Domain: _unused } = _a, types = __rest(_a, ["EIP712Domain"]);
    const rawSignature = yield (signer.signTypedData
        ? signer.signTypedData(typeData.domain, types, typeData.message)
        : signer._signTypedData(typeData.domain, types, typeData.message));
    return splitSignatureToRSV(rawSignature);
});
/**
 * eth_signTypedData_v4：
 * - Coinbase：优先传 typedData 对象（JSON.stringify 会导致 abort）
 * - 其它钱包：优先传 JSON 字符串（MetaMask 习惯）
 * - 用户取消：不再换格式/换方法重试，避免二次弹窗
 */
exports.signData = (provider, fromAddress, typeData) => __awaiter(void 0, void 0, void 0, function* () {
    if (provider._signTypedData || provider.signTypedData) {
        return signWithEthers(provider, fromAddress, typeData);
    }
    const eth = unwrapProvider(provider);
    const preferObject = exports.isCoinbaseProvider(eth);
    const typedObject = typeof typeData === 'string' ? JSON.parse(typeData) : typeData;
    const typedString = typeof typeData === 'string' ? typeData : JSON.stringify(typeData);
    const primary = preferObject ? typedObject : typedString;
    const secondary = preferObject ? typedString : typedObject;
    let result;
    try {
        result = yield exports.send(provider, 'eth_signTypedData_v4', [fromAddress, primary]);
    }
    catch (err1) {
        if (exports.isUserRejectedError(err1)) {
            console.log('[signData] user rejected, stop retry', err1);
            throw err1;
        }
        try {
            result = yield exports.send(provider, 'eth_signTypedData_v4', [fromAddress, secondary]);
        }
        catch (err2) {
            if (exports.isUserRejectedError(err2)) {
                console.log('[signData] user rejected on retry, stop', err2);
                throw err2;
            }
            // 部分旧版钱包仅支持 eth_signTypedData，且要求对象
            const err2Msg = err2 && err2.message;
            if (err2Msg === 'Method eth_signTypedData_v4 not supported.') {
                result = yield exports.send(provider, 'eth_signTypedData', [fromAddress, typedObject]);
            }
            else {
                try {
                    result = yield exports.send(provider, 'eth_signTypedData', [fromAddress, typedObject]);
                }
                catch (err3) {
                    throw err1 || err2 || err3;
                }
            }
        }
    }
    return {
        r: result.slice(0, 66),
        s: '0x' + result.slice(66, 130),
        v: parseInt(result.slice(130, 132), 16),
    };
});
let chainIdOverride = null;
exports.setChainIdOverride = (id) => { chainIdOverride = id; };
exports.getChainId = (provider) => __awaiter(void 0, void 0, void 0, function* () { return chainIdOverride || exports.send(provider, 'eth_chainId'); });
exports.call = (provider, to, data) => exports.send(provider, 'eth_call', [{
        to,
        data,
    }, 'latest']);
