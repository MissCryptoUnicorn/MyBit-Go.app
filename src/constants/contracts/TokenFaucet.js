export const ADDRESS = '0x4a2Ae469e78ec3F4ec2c09eC17f597bEba71fF67';
export const ABI = [
  {
    constant: true,
    inputs: [],
    name: 'tokensInFaucet',
    outputs: [
      {
        name: '',
        type: 'uint256',
      },
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      {
        name: '_from',
        type: 'address',
      },
      {
        name: '_amount',
        type: 'uint256',
      },
      {
        name: '_token',
        type: 'address',
      },
      {
        name: '_data',
        type: 'bytes',
      },
    ],
    name: 'receiveApproval',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      {
        name: '_amount',
        type: 'uint256',
      },
    ],
    name: 'deposit',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      {
        name: '_amount',
        type: 'uint256',
      },
      {
        name: '_pass',
        type: 'string',
      },
    ],
    name: 'withdraw',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'token',
    outputs: [
      {
        name: '',
        type: 'address',
      },
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        name: '_tokenAddress',
        type: 'address',
      },
      {
        name: '_accessPass',
        type: 'bytes32',
      },
    ],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        name: '_sender',
        type: 'address',
      },
      {
        indexed: false,
        name: '_amount',
        type: 'uint256',
      },
      {
        indexed: false,
        name: '_blockNumber',
        type: 'uint256',
      },
    ],
    name: 'TokenWithdraw',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        name: '_depositer',
        type: 'address',
      },
      {
        indexed: false,
        name: '_amount',
        type: 'uint256',
      },
      {
        indexed: false,
        name: '_blockNumber',
        type: 'uint256',
      },
    ],
    name: 'TokenDeposit',
    type: 'event',
  },
];
