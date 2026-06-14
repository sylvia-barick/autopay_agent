import { useState, useEffect } from "react";
import { PrismaHero } from "./components/ui/prisma-hero";
import { Wallet, CheckCircle2, AlertTriangle, Send, Sparkles } from "lucide-react";
import { BrowserProvider, parseEther } from "ethers";

declare global {
  interface Window {
    ethereum?: any;
  }
}

interface Transaction {
  merchant: string;
  amount: number;
  txHash?: string;
  timestamp?: string;
  status?: string;
  method?: string;
}

interface PendingTx {
  merchant: string;
  amount: number;
  status: string;
}

interface DashboardData {
  walletAddress: string;
  balance: string;
  budget: number;
  spent: number;
  remaining: number;
  transactions: Transaction[];
  pendingTx?: PendingTx | null;
  topMerchant?: string;
  topMerchantCount?: number;
  largestTransaction?: number;
  totalTransactions?: number;
  mostUsedMerchant?: string;
  averageTransactionAmount?: string;
  budgetUsagePercent?: number;
}

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [walletBalance, setWalletBalance] = useState("");
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);

  // AI Insights Card state
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [hasLoadedInsights, setHasLoadedInsights] = useState(false);

  // Telegram bot details found in autopay-agent
  const telegramUser = "autopay_agent_bot";
  const [telegramId, setTelegramId] = useState("1198997650");
  const [inputTelegramId, setInputTelegramId] = useState(telegramId);
  const [paymentMethod, setPaymentMethod] = useState<"metamask" | "oneshot">("metamask");

  // Keep input in sync with telegramId when telegramId is loaded
  useEffect(() => {
    setInputTelegramId(telegramId);
  }, [telegramId]);

  const fetchBalance = async (address: string): Promise<string> => {
    if (window.ethereum) {
      try {
        const balanceHex = await window.ethereum.request({
          method: "eth_getBalance",
          params: [address, "latest"],
        });
        const balanceInt = BigInt(balanceHex);
        const balanceEth = (Number(balanceInt) / 1e18).toFixed(4);
        return `${balanceEth} ETH`;
      } catch (err) {
        console.error("Error fetching balance:", err);
        return "0.0000 ETH";
      }
    }
    return "0.0000 ETH";
  };

  const fetchDashboardData = async (tgId: string) => {
    if (!tgId) return;
    try {
      const res = await fetch(`http://localhost:5000/dashboard/${tgId}`);
      if (res.ok) {
        const data = await res.json();
        setDashboard(data);
      } else {
        setDashboard(null);
      }
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    }
  };

  const sendWalletToBackend = async (wallet: string, tgId: string, balance?: string) => {
    if (!wallet || !tgId) return;
    try {
      setError("");
      const res = await fetch("http://localhost:5000/link-wallet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          telegramId: tgId,
          walletAddress: wallet,
          balance: balance || "0.0000 ETH",
        }),
      });
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }
      const data = await res.json();
      console.log(`Linked wallet ${wallet} to TG ID ${tgId}`, data);
      await fetchDashboardData(tgId);
    } catch (err: any) {
      console.error("Error sending wallet to backend:", err);
      setError(`Failed to sync with bot API: ${err.message}`);
    }
  };

  // Check connection on load
  useEffect(() => {
    const checkConnection = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: "eth_accounts" });
          if (accounts && accounts.length > 0) {
            setWalletAddress(accounts[0]);
            setIsConnected(true);
            const balance = await fetchBalance(accounts[0]);
            setWalletBalance(balance);
            sendWalletToBackend(accounts[0], telegramId, balance);
          }
        } catch (err) {
          console.error("Error checking account:", err);
        }
      }
    };
    checkConnection();

    // Listen to account changes
    if (window.ethereum) {
      const handleAccounts = async (accounts: string[]) => {
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          setIsConnected(true);
          const balance = await fetchBalance(accounts[0]);
          setWalletBalance(balance);
          sendWalletToBackend(accounts[0], telegramId, balance);
        } else {
          setWalletAddress("");
          setWalletBalance("");
          setDashboard(null);
          setIsConnected(false);
        }
      };
      window.ethereum.on("accountsChanged", handleAccounts);
      return () => {
        if (window.ethereum && window.ethereum.removeListener) {
          window.ethereum.removeListener("accountsChanged", handleAccounts);
        }
      };
    }
  }, [telegramId]);

  // Effect to load dashboard data when telegramId changes
  useEffect(() => {
    if (telegramId) {
      fetchDashboardData(telegramId);
      setHasLoadedInsights(false);
      setAiResponse("");
      setAiError("");
    }
  }, [telegramId]);

  // Poll dashboard data every 4 seconds to detect updates automatically (like /approve queued in Telegram)
  useEffect(() => {
    if (telegramId) {
      const interval = setInterval(() => {
        fetchDashboardData(telegramId);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [telegramId]);

  const fetchInitialInsights = async (tgId: string) => {
    if (!tgId) return;
    setAiLoading(true);
    setAiError("");
    try {
      const res = await fetch(`http://localhost:5000/dashboard/${tgId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: "Analyze my monthly budget and transaction history. Give me a 2-sentence summary of my spending insights." }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiResponse(data.answer);
      } else {
        setAiResponse("No AI advice available. Make payments to populate your transaction history.");
      }
    } catch (err) {
      console.error("Error fetching initial insights:", err);
      setAiError("Could not retrieve AI insights.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleAskAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!telegramId || !aiQuestion) return;
    setAiLoading(true);
    setAiError("");
    try {
      const res = await fetch(`http://localhost:5000/dashboard/${telegramId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: aiQuestion }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiResponse(data.answer);
        setAiQuestion("");
      } else {
        setAiError("Failed to get response from Venice AI.");
      }
    } catch (err) {
      setAiError("Failed to connect to Venice AI API.");
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  };

  // Load initial automated insights once when dashboard is loaded
  useEffect(() => {
    if (dashboard && !hasLoadedInsights) {
      if (dashboard.transactions && dashboard.transactions.length > 0) {
        fetchInitialInsights(telegramId);
        setHasLoadedInsights(true);
      } else {
        setAiResponse("Set a monthly budget and execute subscription payments to receive automated AI insights.");
        setHasLoadedInsights(true);
      }
    }
  }, [dashboard, telegramId, hasLoadedInsights]);

  const connectWallet = async () => {
    setError("");
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
        if (accounts && accounts.length > 0) {
          setWalletAddress(accounts[0]);
          setIsConnected(true);
          const balance = await fetchBalance(accounts[0]);
          setWalletBalance(balance);
          await sendWalletToBackend(accounts[0], telegramId, balance);
        }
      } catch (err: any) {
        if (err.code === 4001) {
          setError("User rejected the connection request.");
        } else {
          setError("An error occurred. Please try again.");
        }
        console.error("MetaMask connection error:", err);
      }
    } else {
      setError("MetaMask is not installed. Please install the MetaMask extension.");
    }
  };

  const disconnectWallet = () => {
    // In MetaMask, you cannot programmatically revoke connection permissions,
    // but we can clear our local React state.
    setWalletAddress("");
    setWalletBalance("");
    setDashboard(null);
    setIsConnected(false);
  };

  const handleTelegramIdSync = () => {
    if (inputTelegramId && inputTelegramId.trim() !== "") {
      const cleanId = inputTelegramId.trim();
      setTelegramId(cleanId);
      if (isConnected && walletAddress) {
        sendWalletToBackend(walletAddress, cleanId, walletBalance);
      }
    }
  };

  const rejectPayment = async () => {
    if (!telegramId) return;
    try {
      setError("");
      const res = await fetch("http://localhost:5000/reject-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          telegramId,
        }),
      });
      if (res.ok) {
        await fetchDashboardData(telegramId);
      } else {
        setError("Failed to reject transaction on the server.");
      }
    } catch (err: any) {
      console.error("Error rejecting payment:", err);
      setError(`Failed to reject transaction: ${err.message}`);
    }
  };

  const formatAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  return (
    <div className="relative min-h-screen bg-black text-[#E1E0CC]">
      <PrismaHero headingText="AutoPay Agent">
        
        {/* Floating Top Header Area */}
        <div className="absolute left-0 right-0 top-16 z-30 px-6 md:px-12 flex justify-between items-center max-w-7xl mx-auto">
          {/* Logo / App Name */}
          <div className="flex items-center gap-2">
          </div>

          {/* Connect Button or Connection Status */}
          <div className="flex items-center gap-3">
            <a
              href="https://t.me/autopay_agent_bot"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 bg-[#0088cc]/90 hover:bg-[#0088cc] border border-[#0088cc]/30 text-white font-semibold px-5 py-2.5 rounded-full hover:scale-105 transition-all duration-300 shadow-lg text-xs"
            >
              <Send className="w-3.5 h-3.5" />
              Launch Telegram Bot
            </a>
            {!isConnected ? (
              <button
                onClick={connectWallet}
                className="flex items-center gap-2 bg-[#E1E0CC] text-black font-medium px-5 py-2.5 rounded-full hover:bg-white hover:scale-105 transition-all duration-300 shadow-lg text-xs"
              >
                <Wallet className="w-4 h-4" />
                Connect Wallet
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-xs bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 font-medium px-3 py-1.5 rounded-full">
                  {formatAddress(walletAddress)}
                </span>
                <button
                  onClick={disconnectWallet}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full bg-red-950/80 border border-red-500/30 text-red-400 hover:bg-red-900 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Floating Message & Wallet Details Panel */}
        <div className="absolute top-[8%] left-6 md:left-16 z-20 w-[90%] max-w-2xl max-h-[84vh] overflow-y-auto pr-2">
          {error && (
            <div className="mb-4 flex items-center gap-2 bg-red-950/80 border border-red-500/30 text-red-300 p-4 rounded-xl text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {isConnected ? (
            <div className="w-full bg-black/60 backdrop-blur-xl border border-[#E1E0CC]/15 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col gap-6 animate-in fade-in zoom-in duration-500">
              <div className="flex justify-between items-center border-b border-[#E1E0CC]/10 pb-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  <h3 className="text-base md:text-lg font-bold tracking-tight text-white">
                    Agent Dashboard
                  </h3>
                </div>
                <button
                  onClick={() => fetchDashboardData(telegramId)}
                  className="text-xs bg-[#E1E0CC]/10 hover:bg-[#E1E0CC]/20 text-[#E1E0CC] border border-[#E1E0CC]/20 rounded-md px-2.5 py-1 transition-all duration-300 active:scale-95"
                >
                  Refresh
                </button>
              </div>

              {/* Pending Transaction Banner (MetaMask / 1Shot API Selector) */}
              {dashboard && dashboard.pendingTx && (() => {
                const isBudgetInsufficient = dashboard.pendingTx.amount > dashboard.remaining;
                return (
                  <div className={`border-2 rounded-2xl p-5 flex flex-col gap-4.5 ${
                    isBudgetInsufficient 
                      ? "bg-red-950/40 border-red-500/30 animate-none" 
                      : "bg-[#E1E0CC]/5 border-[#E1E0CC]/15"
                  }`}>
                    <div className="flex justify-between items-center border-b border-[#E1E0CC]/10 pb-2">
                      <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                        isBudgetInsufficient ? "text-red-400" : "text-amber-400"
                      }`}>
                        {isBudgetInsufficient 
                          ? "❌ Budget Exceeded: Transaction Blocked" 
                          : paymentMethod === "oneshot"
                          ? "⚡ Pending 1Shot Relayer Execution"
                          : "🦊 Pending MetaMask Confirmation"}
                      </span>
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/20">
                        Sepolia Testnet
                      </span>
                    </div>

                    {!isBudgetInsufficient && (
                      <div className="flex gap-2 bg-black/40 border border-[#E1E0CC]/15 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod("metamask")}
                          className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all duration-250 ${
                            paymentMethod === "metamask"
                              ? "bg-[#E1E0CC] text-black shadow-md"
                              : "text-[#E1E0CC]/60 hover:text-white"
                          }`}
                        >
                          🦊 MetaMask
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod("oneshot")}
                          className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all duration-250 ${
                            paymentMethod === "oneshot"
                              ? "bg-amber-500 text-black shadow-md"
                              : "text-[#E1E0CC]/60 hover:text-white"
                          }`}
                        >
                          ⚡ 1Shot Relayer
                        </button>
                      </div>
                    )}

                    <div className="text-sm text-[#E1E0CC]/95">
                      <span className="text-white font-bold">{dashboard.pendingTx.merchant}</span> requests a payment of{" "}
                      <span className={`font-mono font-bold ${
                        isBudgetInsufficient ? "text-red-400" : "text-amber-300"
                      }`}>${dashboard.pendingTx.amount}</span>.
                      {isBudgetInsufficient && (
                        <div className="text-xs text-red-300 mt-1">
                          Remaining budget of <span className="font-bold">${dashboard.remaining}</span> is insufficient.
                        </div>
                      )}
                    </div>

                    {!isBudgetInsufficient && (
                      <div className="text-xs text-[#E1E0CC]/75 bg-black/30 border border-[#E1E0CC]/5 p-3 rounded-xl leading-relaxed">
                        {paymentMethod === "metamask" ? (
                          <div className="flex flex-col gap-1">
                            <span className="font-semibold text-white">🦊 MetaMask Manual Route</span>
                            <span>Direct on-chain transaction. Requires you to manually sign the transaction in MetaMask and pay Sepolia ETH gas fees.</span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <span className="font-semibold text-amber-400">⚡ 1Shot API Gasless Route</span>
                            <span>Relays the payment through the 1Shot relayer API, bypassing manual gas popups and sponsoring Sepolia gas fees using 1Shot's managed wallets.</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex gap-3">
                      {!isBudgetInsufficient ? (
                        paymentMethod === "metamask" ? (
                          <button
                            onClick={async () => {
                              if (!window.ethereum) {
                                setError("MetaMask is not installed. Please install MetaMask to continue.");
                                return;
                              }
                              const pending = dashboard?.pendingTx;
                              if (!pending) return;
                              try {
                                setError("");
                                
                                // Switch network to Sepolia (0xaa36a7)
                                const chainId = await window.ethereum.request({ method: "eth_chainId" });
                                if (chainId !== "0xaa36a7") {
                                  try {
                                    await window.ethereum.request({
                                      method: "wallet_switchEthereumChain",
                                      params: [{ chainId: "0xaa36a7" }],
                                    });
                                  } catch (switchError: any) {
                                    if (switchError.code === 4902) {
                                      await window.ethereum.request({
                                        method: "wallet_addEthereumChain",
                                        params: [{
                                          chainId: "0xaa36a7",
                                          chainName: "Sepolia Test Network",
                                          nativeCurrency: { name: "Sepolia Ether", symbol: "SEP", decimals: 18 },
                                          rpcUrls: ["https://rpc.ancora.rocks/sepolia"],
                                          blockExplorerUrls: ["https://sepolia.etherscan.io"]
                                        }]
                                      });
                                    } else {
                                      throw switchError;
                                    }
                                  }
                                }

                                // Use Ethers.js to sign and execute Sepolia Transaction
                                const provider = new BrowserProvider(window.ethereum);
                                const signer = await provider.getSigner();

                                // Convert amount to micro-ETH (e.g. 1 unit = 0.0001 ETH) to prevent faucet exhaustion
                                const ethVal = (pending.amount * 0.0001).toFixed(6);

                                const txResponse = await signer.sendTransaction({
                                  to: "0x2d38928e42b1eeBDE0859820d3B96214F6dFad07", // Merchant address
                                  value: parseEther(ethVal),
                                });

                                // Wait for transaction to be mined (confirmed) on Sepolia
                                await txResponse.wait();

                                const txHash = txResponse.hash;

                                // Call execute payment on server to save transaction state
                                const res = await fetch("http://localhost:5000/execute-payment", {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    telegramId,
                                    txHash,
                                    merchant: pending.merchant,
                                    amount: pending.amount,
                                  }),
                                });

                                if (res.ok) {
                                  await fetchDashboardData(telegramId);
                                  const balance = await fetchBalance(walletAddress);
                                  setWalletBalance(balance);
                                } else {
                                  const errorData = await res.json();
                                  setError(errorData.error || "Failed to register payment execution on the server.");
                                }
                              } catch (err: any) {
                                console.error("MetaMask execution error:", err);
                                setError(`MetaMask Error: ${err.message || err}`);
                              }
                            }}
                            className="flex-1 bg-[#E1E0CC] hover:bg-white text-black font-bold py-2.5 rounded-xl hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 shadow-md text-xs"
                          >
                            Approve in MetaMask (Sepolia)
                          </button>
                        ) : (
                          <button
                            onClick={async () => {
                              const pending = dashboard?.pendingTx;
                              if (!pending) return;
                              try {
                                setError("");
                                const res = await fetch("http://localhost:5000/execute-1shot-payment", {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    telegramId,
                                    merchant: pending.merchant,
                                    amount: pending.amount,
                                  }),
                                });

                                if (res.ok) {
                                  await fetchDashboardData(telegramId);
                                  if (walletAddress) {
                                    const balance = await fetchBalance(walletAddress);
                                    setWalletBalance(balance);
                                  }
                                } else {
                                  const errorData = await res.json();
                                  setError(errorData.error || "Failed to execute 1Shot relayer payment.");
                                }
                              } catch (err: any) {
                                console.error("1Shot relayer execution error:", err);
                                setError(`1Shot Relayer Error: ${err.message || err}`);
                              }
                            }}
                            className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-bold py-2.5 rounded-xl hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 shadow-md text-xs"
                          >
                            Execute via 1Shot Relayer (Gasless)
                          </button>
                        )
                      ) : (
                        <button
                          disabled
                          className="flex-1 bg-white/5 text-[#E1E0CC]/30 border border-[#E1E0CC]/10 font-bold py-2.5 rounded-xl cursor-not-allowed text-xs"
                        >
                          Blocked: Insufficient Budget
                        </button>
                      )}
                      <button
                        onClick={rejectPayment}
                        className="flex-1 bg-red-950/85 hover:bg-red-900 border border-red-500/30 text-red-400 font-bold py-2.5 rounded-xl hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 text-xs"
                      >
                        Reject Request
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Grid Metrics */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[#E1E0CC]/5 border border-[#E1E0CC]/10 rounded-2xl p-4 flex flex-col gap-1">
                  <span className="text-xs text-[#E1E0CC]/60 font-medium">Monthly Budget</span>
                  <span className="text-xl font-bold text-white">
                    ${dashboard ? dashboard.budget : 0}
                  </span>
                </div>
                <div className="bg-[#E1E0CC]/5 border border-[#E1E0CC]/10 rounded-2xl p-4 flex flex-col gap-1">
                  <span className="text-xs text-[#E1E0CC]/60 font-medium">Total Spent</span>
                  <span className="text-xl font-bold text-white">
                    ${dashboard ? dashboard.spent : 0}
                  </span>
                </div>
                <div className="bg-[#E1E0CC]/5 border border-[#E1E0CC]/10 rounded-2xl p-4 flex flex-col gap-1">
                  <span className="text-xs text-[#E1E0CC]/60 font-medium">Remaining</span>
                  <span className="text-xl font-bold text-emerald-400">
                    ${dashboard ? dashboard.remaining : 0}
                  </span>
                </div>
              </div>

              {/* Budget Usage Progress Bar */}
              <div className="bg-[#E1E0CC]/5 border border-[#E1E0CC]/10 rounded-2xl p-4 flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-[#E1E0CC]/60">Budget Utilization</span>
                  <span className={`font-bold ${
                    (dashboard?.budgetUsagePercent || 0) >= 100
                      ? "text-red-400"
                      : (dashboard?.budgetUsagePercent || 0) >= 80
                      ? "text-amber-400"
                      : "text-emerald-400"
                  }`}>
                    {dashboard ? dashboard.budgetUsagePercent : 0}% (${dashboard ? dashboard.spent : 0} spent of ${dashboard ? dashboard.budget : 0})
                  </span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      (dashboard?.budgetUsagePercent || 0) >= 100
                        ? "bg-red-500"
                        : (dashboard?.budgetUsagePercent || 0) >= 80
                        ? "bg-amber-500"
                        : "bg-emerald-400"
                    }`}
                    style={{ width: `${Math.min(dashboard?.budgetUsagePercent || 0, 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* Advanced Analytics Metrics */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[#E1E0CC]/5 border border-[#E1E0CC]/10 rounded-2xl p-4 flex flex-col gap-1">
                  <span className="text-xs text-[#E1E0CC]/60 font-medium">Top Merchant</span>
                  <span className="text-xl font-bold text-white truncate" title={dashboard?.topMerchant || "N/A"}>
                    {dashboard?.topMerchant || "N/A"}
                  </span>
                  {dashboard?.topMerchantCount ? (
                    <span className="text-[10px] text-[#E1E0CC]/40">
                      {dashboard.topMerchantCount} {dashboard.topMerchantCount === 1 ? 'transaction' : 'transactions'}
                    </span>
                  ) : null}
                </div>
                <div className="bg-[#E1E0CC]/5 border border-[#E1E0CC]/10 rounded-2xl p-4 flex flex-col gap-1">
                  <span className="text-xs text-[#E1E0CC]/60 font-medium">Largest Payment</span>
                  <span className="text-xl font-bold text-white">
                    ${dashboard?.largestTransaction || 0}
                  </span>
                </div>
                <div className="bg-[#E1E0CC]/5 border border-[#E1E0CC]/10 rounded-2xl p-4 flex flex-col gap-1">
                  <span className="text-xs text-[#E1E0CC]/60 font-medium">Total Transactions</span>
                  <span className="text-xl font-bold text-white">
                    {dashboard?.totalTransactions || 0}
                  </span>
                </div>
              </div>

              {/* AI Insights Card */}
              <div className="bg-[#E1E0CC]/5 border border-[#E1E0CC]/10 rounded-3xl p-5 flex flex-col gap-4">
                <div className="flex items-center gap-2 text-white font-bold">
                  <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
                  <span className="text-sm">AI Financial Advisor Insights</span>
                </div>
                
                {aiLoading ? (
                  <div className="flex flex-col gap-2 py-2 animate-pulse">
                    <div className="h-3.5 bg-[#E1E0CC]/10 rounded w-3/4"></div>
                    <div className="h-3.5 bg-[#E1E0CC]/10 rounded w-5/6"></div>
                    <div className="h-3.5 bg-[#E1E0CC]/10 rounded w-1/2"></div>
                    <div className="text-[10px] text-[#E1E0CC]/40 flex items-center gap-1.5 mt-1">
                      <div className="w-3.5 h-3.5 border-2 border-t-transparent border-[#E1E0CC]/60 rounded-full animate-spin"></div>
                      <span>Venice AI is analyzing spending patterns...</span>
                    </div>
                  </div>
                ) : aiError ? (
                  <p className="text-xs text-red-400 bg-red-950/20 border border-red-500/20 p-3 rounded-xl">{aiError}</p>
                ) : (
                  <p className="text-xs text-[#E1E0CC]/90 leading-relaxed bg-black/40 p-3 rounded-xl border border-[#E1E0CC]/5">
                    {aiResponse || "No advice requested yet. Ask a question below to analyze your budget and spending."}
                  </p>
                )}

                <form onSubmit={handleAskAI} className="flex gap-2">
                  <input
                    type="text"
                    value={aiQuestion}
                    onChange={(e) => setAiQuestion(e.target.value)}
                    placeholder="e.g., Why was my budget exceeded?"
                    className="flex-1 bg-white/5 border border-[#E1E0CC]/20 rounded-xl px-3 py-2 text-xs text-white placeholder-[#E1E0CC]/30 focus:outline-none focus:border-[#E1E0CC]/50 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={aiLoading || !aiQuestion}
                    className="bg-[#E1E0CC] hover:bg-white text-black font-semibold text-xs px-4 py-2 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1.5"
                  >
                    Ask Venice
                  </button>
                </form>
              </div>

              {/* Profile & Wallet Information */}
              <div className="flex flex-col gap-4 text-sm border-t border-b border-[#E1E0CC]/10 py-4">
                <div className="flex justify-between items-center border-b border-[#E1E0CC]/5 pb-2">
                  <span className="text-[#E1E0CC]/60 font-medium">Telegram User:</span>
                  <a
                    href={`https://t.me/${telegramUser}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-white font-semibold flex items-center gap-1.5 hover:underline hover:text-sky-400 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    @{telegramUser}
                  </a>
                </div>

                <div className="flex justify-between items-center border-b border-[#E1E0CC]/5 pb-2">
                  <span className="text-[#E1E0CC]/60 font-medium">Telegram ID:</span>
                  <input
                    type="text"
                    value={inputTelegramId}
                    onChange={(e) => setInputTelegramId(e.target.value)}
                    onBlur={handleTelegramIdSync}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleTelegramIdSync();
                      }
                    }}
                    className="bg-white/5 border border-[#E1E0CC]/20 rounded-md px-2 py-0.5 text-white font-mono text-sm text-right w-36 focus:outline-none focus:border-[#E1E0CC]/50 transition-colors"
                  />
                </div>

                <div className="flex justify-between items-center border-b border-[#E1E0CC]/5 pb-2">
                  <span className="text-[#E1E0CC]/60 font-medium">Wallet Balance:</span>
                  <span className="text-white font-mono font-semibold">
                    {walletBalance || (dashboard ? dashboard.balance : "Loading...")}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[#E1E0CC]/60 font-medium">MetaMask Wallet:</span>
                  <span className="bg-[#E1E0CC]/5 border border-[#E1E0CC]/10 rounded-lg p-2.5 font-mono text-xs text-white break-all text-center">
                    {walletAddress}
                  </span>
                </div>
              </div>

              {/* Recent Transactions List */}
              <div className="flex flex-col gap-3">
                <span className="text-sm font-bold text-white">Recent Transactions</span>
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                  {dashboard && dashboard.transactions && dashboard.transactions.length > 0 ? (
                    dashboard.transactions.slice().reverse().map((tx, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col gap-1 bg-[#E1E0CC]/5 border border-[#E1E0CC]/10 rounded-xl px-4 py-3 text-xs"
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">{tx.merchant}</span>
                            {tx.method && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                tx.method === "1Shot API" 
                                  ? "bg-amber-500/20 border border-amber-500/30 text-amber-300" 
                                  : "bg-[#E1E0CC]/15 border border-[#E1E0CC]/25 text-[#E1E0CC]/80"
                              }`}>
                                {tx.method}
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-red-400 font-semibold">-${tx.amount}</span>
                        </div>
                        {tx.txHash && (
                          <a
                            href={`https://sepolia.etherscan.io/tx/${tx.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-[#E1E0CC]/50 font-mono break-all hover:underline hover:text-sky-400 transition-colors"
                          >
                            Hash: {tx.txHash.substring(0, 10)}...{tx.txHash.substring(tx.txHash.length - 8)}
                          </a>
                        )}
                        {tx.timestamp && (
                          <span className="text-[9px] text-[#E1E0CC]/30 font-mono">
                            {new Date(tx.timestamp).toLocaleString()}
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-[#E1E0CC]/40 italic text-center py-2">
                      No recent transactions
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full bg-black/40 backdrop-blur-md border border-[#E1E0CC]/10 rounded-3xl p-6 md:p-8 shadow-xl flex flex-col items-center text-center gap-5">
              <div className="bg-[#E1E0CC]/10 p-4 rounded-full">
                <Wallet className="w-8 h-8 text-[#E1E0CC]" />
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="text-lg font-bold text-white">Link MetaMask Wallet</h3>
                <p className="text-xs text-[#E1E0CC]/60 leading-relaxed">
                  Connect your MetaMask wallet to view linked status, telegram ID, and authorize agent autopays.
                </p>
              </div>
              <div className="w-full flex items-center justify-between border-t border-[#E1E0CC]/10 pt-4 text-sm">
                <span className="text-[#E1E0CC]/60 font-medium">Telegram ID:</span>
                <input
                  type="text"
                  value={inputTelegramId}
                  onChange={(e) => setInputTelegramId(e.target.value)}
                  onBlur={handleTelegramIdSync}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleTelegramIdSync();
                    }
                  }}
                  className="bg-white/5 border border-[#E1E0CC]/20 rounded-md px-2 py-0.5 text-white font-mono text-sm text-right w-36 focus:outline-none focus:border-[#E1E0CC]/50 transition-colors"
                />
              </div>
              <button
                onClick={connectWallet}
                className="w-full bg-[#E1E0CC] text-black font-semibold py-3 rounded-full hover:bg-white hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
              >
                Connect Wallet
              </button>
            </div>
          )}
        </div>
      </PrismaHero>
    </div>
  );
}
