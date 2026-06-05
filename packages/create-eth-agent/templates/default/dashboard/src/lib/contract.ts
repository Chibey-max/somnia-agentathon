export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  '0xE49A6044D47De19504B73aA36F31899843B05259') as `0x${string}`;

export const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '11155111');

export const ALCHEMY_RPC_URL =
  process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL ||
  'https://eth-sepolia.g.alchemy.com/v2/demo';

export const ANKR_RPC_URL =
  process.env.NEXT_PUBLIC_ANKR_RPC_URL ||
  'https://rpc.ankr.com/eth_sepolia/1092ec888da7f98c638afd3663c60205e2bbf66b293de56abcc22904bf2213ed';

export const QUICKNODE_RPC_URL =
  process.env.NEXT_PUBLIC_QUICKNODE_RPC_URL ||
  '';

export const RPC_URLS = Array.from(
  new Set([ALCHEMY_RPC_URL, ANKR_RPC_URL, QUICKNODE_RPC_URL].filter(Boolean))
);

export const GUARDIAN_ADDRESS = (process.env.NEXT_PUBLIC_GUARDIAN_ADDRESS ||
  '0xd9100b701e21fC578BFD937AC2DbDfb5bbD42572') as `0x${string}`;

export const AGENT_WALLET_ABI = [
  // View functions
  { name: 'agent', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'pendingAgent', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'guardian', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'pendingGuardian', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'paused', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { name: 'ethTxLimit', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'ethDailyLimit', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'ethDailySpent', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'ethLastReset', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    name: 'tokenPolicy',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [
      { name: 'dailyLimit', type: 'uint256' },
      { name: 'dailySpent', type: 'uint256' },
      { name: 'lastReset', type: 'uint256' },
      { name: 'enabled', type: 'bool' },
    ],
  },
  {
    name: 'pendingLimitChange',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'txLimit', type: 'uint256' },
      { name: 'dailyLimit', type: 'uint256' },
      { name: 'unlockTime', type: 'uint256' },
      { name: 'queued', type: 'bool' },
    ],
  },
  {
    name: 'pendingCall',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'target', type: 'address' },
      { name: 'selector', type: 'bytes4' },
      { name: 'checkRecipient', type: 'bool' },
      { name: 'checkAmount', type: 'bool' },
      { name: 'maxAmount', type: 'uint256' },
      { name: 'unlockTime', type: 'uint256' },
      { name: 'queued', type: 'bool' },
    ],
  },
  {
    name: 'isRecipientAllowed',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'target', type: 'address' },
      { name: 'sel', type: 'bytes4' },
      { name: 'recipient', type: 'address' },
    ],
    outputs: [{ type: 'bool' }],
  },
  // Write functions (guardian)
  { name: 'pause', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'unpause', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'transferAgent',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'newAgent', type: 'address' }],
    outputs: [],
  },
  {
    name: 'acceptAgent',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'transferGuardian',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'newGuardian', type: 'address' }],
    outputs: [],
  },
  {
    name: 'acceptGuardian',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'queueCall',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'target', type: 'address' },
      { name: 'selector', type: 'bytes4' },
      { name: 'checkRecipient', type: 'bool' },
      { name: 'checkAmount', type: 'bool' },
      { name: 'maxAmount', type: 'uint256' },
    ],
    outputs: [],
  },
  { name: 'applyCall', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'cancelCallQueue', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  {
    name: 'removeCall',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'target', type: 'address' }, { name: 'selector', type: 'bytes4' }],
    outputs: [],
  },
  {
    name: 'addRecipient',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'target', type: 'address' }, { name: 'sel', type: 'bytes4' }, { name: 'recipient', type: 'address' }],
    outputs: [],
  },
  {
    name: 'removeRecipient',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'target', type: 'address' }, { name: 'sel', type: 'bytes4' }, { name: 'recipient', type: 'address' }],
    outputs: [],
  },
  {
    name: 'setTokenPolicy',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'token', type: 'address' }, { name: '_dailyLimit', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'revokeTokenPolicy',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [],
  },
  {
    name: 'queueLimitChange',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_txLimit', type: 'uint256' }, { name: '_dailyLimit', type: 'uint256' }],
    outputs: [],
  },
  { name: 'applyLimitChange', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'cancelLimitChange', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  {
    name: 'decreaseLimits',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_txLimit', type: 'uint256' }, { name: '_dailyLimit', type: 'uint256' }],
    outputs: [],
  },
  // Events
  {
    name: 'Executed',
    type: 'event',
    inputs: [
      { name: 'target', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
      { name: 'selector', type: 'bytes4', indexed: false },
    ],
  },
  {
    name: 'Withdrawn',
    type: 'event',
    inputs: [
      { name: 'to', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  { name: 'Paused', type: 'event', inputs: [{ name: 'by', type: 'address', indexed: true }] },
  { name: 'Unpaused', type: 'event', inputs: [{ name: 'by', type: 'address', indexed: true }] },
  {
    name: 'CallQueued',
    type: 'event',
    inputs: [
      { name: 'target', type: 'address', indexed: true },
      { name: 'selector', type: 'bytes4', indexed: false },
      { name: 'unlockTime', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'CallApplied',
    type: 'event',
    inputs: [
      { name: 'target', type: 'address', indexed: true },
      { name: 'selector', type: 'bytes4', indexed: false },
    ],
  },
  {
    name: 'LimitChangeQueued',
    type: 'event',
    inputs: [
      { name: 'txLimit', type: 'uint256', indexed: false },
      { name: 'daily', type: 'uint256', indexed: false },
      { name: 'unlockTime', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'TokenPolicySet',
    type: 'event',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'dailyLimit', type: 'uint256', indexed: false },
    ],
  },
] as const;
