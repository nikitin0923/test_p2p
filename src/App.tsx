import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

// Types
interface PaymentData {
  payment_holder: string;
  payment_method: string;
  payment_system: string;
  payment_requisite: string;
  payment_expires_at: string;
  qr_code_encoded?: string;
  pay_link?: string;
}

interface Transaction {
  tracker_id: string;
  status: 'ACCEPTED' | 'SUCCESS' | 'DECLINED';
  payment_data: PaymentData;
  amount: number;
  currency: string;
  amount_to_pay: number;
}

const CURRENCIES = {
  KZT: { methods: ['CARD'], banks: ['BEREKEBANK', 'JYSANBANK', 'ANY'] },
  AZN: { 
    methods: ['CARD', 'MOBILE_NUMBER', 'QR'], 
    banks: {
      CARD: ['KAPITALBANK', 'ANY'],
      MOBILE_NUMBER: ['M10', 'MPAY'],
      QR: ['M10']
    }
  },
  UZS: {
    methods: ['CARD', 'MOBILE_NUMBER', 'QR'],
    banks: {
      CARD: ['HUMO', 'UZCARD', 'ANY'],
      MOBILE_NUMBER: ['PAYMEMOBILE'],
      QR: ['CLICK']
    }
  },
  TJS: { methods: ['CARD'], banks: ['DUSHANBECITY', 'SPITAMEN', 'ANY'] },
  KGS: { methods: ['CARD'], banks: ['MBANK', 'OPTIMA', 'ANY'] }
};

const mockCreateTransaction = async (data: any): Promise<Transaction> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        tracker_id: Math.random().toString(36).substring(7),
        status: 'ACCEPTED',
        payment_data: {
          payment_holder: 'John Smith',
          payment_method: `[60] ${data.currency}-P2P_CIS-${data.sub_method}`,
          payment_system: data.bank_token,
          payment_requisite: '4242424242424242',
          payment_expires_at: new Date(Date.now() + 3600000).toISOString(),
          ...(data.sub_method === 'QR' && {
            qr_code_encoded: 'base64encodedQRcode',
            pay_link: 'https://payment-app.com/pay'
          })
        },
        amount: data.amount,
        currency: data.currency,
        amount_to_pay: data.amount
      });
    }, 1000);
  });
};

export const P2PCISPayment = () => {
  const [currency, setCurrency] = useState('KZT');
  const [method, setMethod] = useState('CARD');
  const [bank, setBank] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('p2p_transactions');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    const defaultBank = getDefaultBank();
    if (defaultBank) setBank(defaultBank);
  }, [currency, method]);

  useEffect(() => {
    if (transaction) {
      const timer = setInterval(() => {
        if (transaction.status === 'ACCEPTED') {
          const newStatus = Math.random() > 0.5 ? 'SUCCESS' : 'DECLINED';
          updateTransactionStatus(transaction.tracker_id, newStatus);
        }
      }, 5000);

      return () => clearInterval(timer);
    }
  }, [transaction]);

  const getDefaultBank = () => {
    const currencyConfig = CURRENCIES[currency as keyof typeof CURRENCIES];
    if (!currencyConfig) return '';

    if (typeof currencyConfig.banks === 'object' && !Array.isArray(currencyConfig.banks)) {
      return currencyConfig.banks[method]?.[0] || '';
    }
    return Array.isArray(currencyConfig.banks) ? currencyConfig.banks[0] : '';
  };

  const updateTransactionStatus = (trackerId: string, newStatus: string) => {
    const updatedTransactions = transactions.map(t => 
      t.tracker_id === trackerId ? { ...t, status: newStatus as 'SUCCESS' | 'DECLINED' } : t
    );
    setTransactions(updatedTransactions);
    localStorage.setItem('p2p_transactions', JSON.stringify(updatedTransactions));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await mockCreateTransaction({
        currency,
        sub_method: method,
        bank_token: bank,
        amount: parseFloat(amount)
      });

      setTransaction(response);
      const newTransactions = [...transactions, response];
      setTransactions(newTransactions);
      localStorage.setItem('p2p_transactions', JSON.stringify(newTransactions));
      setShowModal(true);
    } catch (error) {
      console.error('Error creating transaction:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACCEPTED': return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'SUCCESS': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'DECLINED': return <XCircle className="h-5 w-5 text-red-500" />;
      default: return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Payment Form */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-bold mb-6">P2P CIS Payment</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Currency</label>
                <select
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  {Object.keys(CURRENCIES).map((curr) => (
                    <option key={curr} value={curr}>{curr}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Method</label>
                <select
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  {CURRENCIES[currency as keyof typeof CURRENCIES]?.methods.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Bank</label>
                <select
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2"
                  value={bank}
                  onChange={(e) => setBank(e.target.value)}
                >
                  {(typeof CURRENCIES[currency as keyof typeof CURRENCIES]?.banks === 'object' && 
                   !Array.isArray(CURRENCIES[currency as keyof typeof CURRENCIES]?.banks)
                    ? CURRENCIES[currency as keyof typeof CURRENCIES]?.banks[method]
                    : CURRENCIES[currency as keyof typeof CURRENCIES]?.banks
                  )?.map((b: string) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Amount</label>
                <input
                  type="number"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="1"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Creating transaction...' : 'Create Transaction'}
            </button>
          </form>
        </div>

        {/* Transactions List */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-xl font-semibold mb-4">Transactions</h3>
          <div className="space-y-4">
            {transactions.map((t) => (
              <div key={t.tracker_id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  {getStatusIcon(t.status)}
                  <div>
                    <p className="font-medium">{t.payment_data.payment_method}</p>
                    <p className="text-sm text-gray-500">
                      {t.amount_to_pay} {t.currency}
                    </p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium
                  ${t.status === 'SUCCESS' ? 'bg-green-100 text-green-800' :
                    t.status === 'DECLINED' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'}`}>
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Details Modal */}
        <Dialog.Root open={showModal} onOpenChange={setShowModal}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/50" />
            <Dialog.Content className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] bg-white rounded-lg p-6 w-full max-w-md">
              <Dialog.Title className="text-lg font-semibold mb-4">
                Payment Details
              </Dialog.Title>
              {transaction && (
                <div className="space-y-4">
                  <div className="border-b pb-4">
                    <p className="text-sm text-gray-500">Amount to Pay</p>
                    <p className="text-lg font-semibold">
                      {transaction.amount_to_pay} {transaction.currency}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-gray-500">Payment System</p>
                      <p className="font-medium">{transaction.payment_data.payment_system}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Payment Requisite</p>
                      <p className="font-medium">{transaction.payment_data.payment_requisite}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Holder</p>
                      <p className="font-medium">{transaction.payment_data.payment_holder}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Expires At</p>
                      <p className="font-medium">
                        {new Date(transaction.payment_data.payment_expires_at).toLocaleString()}
                      </p>
                    </div>
                    {transaction.payment_data.qr_code_encoded && (
                      <div>
                        <p className="text-sm text-gray-500">QR Code</p>
                        <img 
                          src={`data:image/png;base64,${transaction.payment_data.qr_code_encoded}`}
                          alt="Payment QR Code"
                          className="w-48 h-48 mx-auto mt-2"
                        />
                      </div>
                    )}
                    {transaction.payment_data.pay_link && (
                      <a
                        href={transaction.payment_data.pay_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block mt-4 text-center py-2 px-4 border border-transparent rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                      >
                        Open Payment App
                      </a>
                    )}
                  </div>
                </div>
              )}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </div>
  );
};

export default P2PCISPayment;
