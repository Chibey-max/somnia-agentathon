import { NextRequest, NextResponse } from 'next/server';
import { encodeFunctionData, parseEther } from 'viem';
import { CONTRACT_ADDRESS, AGENT_WALLET_ABI } from '@/lib/contract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// This route builds calldata for guardian actions.
// The frontend signs and sends the tx using wagmi (connected wallet).
// We never handle private keys here.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, ...params } = body;

    let calldata: `0x${string}`;

    switch (type) {
      case 'pause':
        calldata = encodeFunctionData({ abi: AGENT_WALLET_ABI, functionName: 'pause' });
        break;
      case 'unpause':
        calldata = encodeFunctionData({ abi: AGENT_WALLET_ABI, functionName: 'unpause' });
        break;
      case 'withdraw':
        calldata = encodeFunctionData({
          abi: AGENT_WALLET_ABI,
          functionName: 'withdraw',
          args: [params.to as `0x${string}`, parseEther(params.amount)],
        });
        break;
      case 'transferAgent':
        calldata = encodeFunctionData({
          abi: AGENT_WALLET_ABI,
          functionName: 'transferAgent',
          args: [params.newAgent as `0x${string}`],
        });
        break;
      case 'transferGuardian':
        calldata = encodeFunctionData({
          abi: AGENT_WALLET_ABI,
          functionName: 'transferGuardian',
          args: [params.newGuardian as `0x${string}`],
        });
        break;
      case 'queueCall':
        calldata = encodeFunctionData({
          abi: AGENT_WALLET_ABI,
          functionName: 'queueCall',
          args: [
            params.target as `0x${string}`,
            params.selector as `0x${string}`,
            params.checkRecipient,
            params.checkAmount,
            parseEther(params.maxAmount || '0'),
          ],
        });
        break;
      case 'applyCall':
        calldata = encodeFunctionData({ abi: AGENT_WALLET_ABI, functionName: 'applyCall' });
        break;
      case 'cancelCallQueue':
        calldata = encodeFunctionData({ abi: AGENT_WALLET_ABI, functionName: 'cancelCallQueue' });
        break;
      case 'removeCall':
        calldata = encodeFunctionData({
          abi: AGENT_WALLET_ABI,
          functionName: 'removeCall',
          args: [params.target as `0x${string}`, params.selector as `0x${string}`],
        });
        break;
      case 'queueLimitChange':
        calldata = encodeFunctionData({
          abi: AGENT_WALLET_ABI,
          functionName: 'queueLimitChange',
          args: [parseEther(params.txLimit), parseEther(params.dailyLimit)],
        });
        break;
      case 'applyLimitChange':
        calldata = encodeFunctionData({ abi: AGENT_WALLET_ABI, functionName: 'applyLimitChange' });
        break;
      case 'cancelLimitChange':
        calldata = encodeFunctionData({ abi: AGENT_WALLET_ABI, functionName: 'cancelLimitChange' });
        break;
      case 'setTokenPolicy':
        calldata = encodeFunctionData({
          abi: AGENT_WALLET_ABI,
          functionName: 'setTokenPolicy',
          args: [params.token as `0x${string}`, parseEther(params.dailyLimit)],
        });
        break;
      case 'revokeTokenPolicy':
        calldata = encodeFunctionData({
          abi: AGENT_WALLET_ABI,
          functionName: 'revokeTokenPolicy',
          args: [params.token as `0x${string}`],
        });
        break;
      default:
        return NextResponse.json({ error: `Unknown action: ${type}` }, { status: 400 });
    }

    return NextResponse.json({
      to: CONTRACT_ADDRESS,
      calldata,
      type,
    });
  } catch (error) {
    console.error('[/api/guardian]', error);
    return NextResponse.json(
      { error: 'Failed to build guardian action', details: String(error) },
      { status: 500 }
    );
  }
}
