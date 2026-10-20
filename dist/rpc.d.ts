/** Coinbase Wallet（尤其内置 dapp 浏览器）对 typedData 二次 JSON.stringify 会生成消息失败，需要传对象 */
export declare const isCoinbaseProvider: (provider: any) => boolean;
/** 用户主动取消签名时禁止再 fallback，否则会立刻再弹一次授权窗 */
export declare const isUserRejectedError: (err: any) => boolean;
/** 规范化 EIP-712 uint 字段，避免空字符串导致「生成消息时发生错误」 */
export declare const normalizeUint: (value: any, fallback?: string | number) => string | number;
export declare const send: (provider: any, method: string, params?: any[] | undefined) => Promise<any>;
export interface RSV {
    r: string;
    s: string;
    v: number;
}
/**
 * eth_signTypedData_v4：
 * - Coinbase：必须传 typedData 对象。若传 JSON 字符串，内置浏览器常会再 stringify，导致「生成消息时发生错误」
 * - 其它钱包：优先 JSON 字符串（MetaMask 习惯）
 * - 用户取消：不再换格式/换方法重试，避免二次弹窗
 */
export declare const signData: (provider: any, fromAddress: string, typeData: any) => Promise<RSV>;
export declare const setChainIdOverride: (id: number) => void;
export declare const getChainId: (provider: any) => Promise<any>;
export declare const call: (provider: any, to: string, data: string) => Promise<any>;
