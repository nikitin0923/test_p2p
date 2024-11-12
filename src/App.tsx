import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import hmacSHA512 from 'crypto-js/hmac-sha512';

// API Configuration
const API_CONFIG = {
  BASE_URL: 'https://api.am-pay.su/v2',
  API_PUBLIC: 'your_public_key',  // Ваш публичный ключ
  API_PRIVATE: 'your_private_key', // Ваш приватный ключ
};

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

interface TransactionRecord extends Transaction {
  created_at: string;
  updated_at: string;
  response_time?: string;
}

interface TransactionData {
  currency: string;
  amount: number;
  sub_method: string;
  bank_token: string;
  callback_url: string;
  client_transaction_id: string;
  client_merchant_id: string;
  customer: {
    ip: string;
    full_name?: string;
    email?: string;
    phone?: string;
  };
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

// API Class
class API {
  private generateSignature(data: any, timestamp: string): string {
    const flattenDict = (obj: any): string[] => {
      const result: string[] = [];
      Object.values(obj).forEach(value => {
        if (value && typeof value === 'object') {
          result.push(...flattenDict(value));
        } else {
          result.push(String(value));
        }
      });
      return result;
    };

    const values = [...flattenDict(data), timestamp].sort();
    const concatenatedValues = values.join(';');
    return hmacSHA512(concatenatedValues, API_CONFIG.API_PRIVATE).toString();
  }

  private async makeRequest(endpoint: string, data: any): Promise<any> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = this.generateSignature(data, timestamp);

    const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Apipublic': API_CONFIG.API_PUBLIC,
        'Signature': signature,
        'TimeStamp': timestamp
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'API request failed');
    }

    return response.json();
  }

  private storeTransaction(transaction: TransactionRecord) {
    const transactions = this.getStoredTransactions();
    transactions.push(transaction);
    localStorage.setItem('transactions', JSON.stringify(transactions));
  }

  public getStoredTransactions(): TransactionRecord[] {
    const stored = localStorage.getItem('transactions');
    return stored ? JSON.parse(stored) : [];
  }

  public async createTransaction(data: TransactionData): Promise<Transaction> {
    const startTime = new Date();
    const response = await this.makeRequest('/transaction/create/in/P2P_CIS/', data);
    const endTime = new Date();

    const transaction: TransactionRecord = {
      ...response,
      created_at: startTime.toISOString(),
      updated_at: endTime.toISOString(),
      response_time: `${endTime.getTime() - startTime.getTime()}ms`
    };

    this.storeTransaction(transaction);
    return response;
  }

  public async checkTransactionStatus(trackerId: string): Promise<string> {
    const response = await this.makeRequest(`/transaction/${trackerId}/`, {});
    
    const transactions = this.getStoredTransactions();
    const updatedTransactions = transactions.map(t => {
      if (t.tracker_id === trackerId) {
        return {
          ...t,
          status: response.status,
          updated_at: new Date().toISOString()
        };
      }
      return t;
    });
    
    localStorage.setItem('transactions', JSON.stringify(updatedTransactions));
    return response.status;
  }
}

const api = new API();
// Transactions Table Component
const TransactionsTable = () => {
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);

  useEffect(() => {
    setTransactions(api.getStoredTransactions());

    // Обновление статусов каждые 30 секунд
    const interval = setInterval(() => {
      const pendingTransactions = transactions.filter(t => t.status === 'ACCEPTED');
      pendingTransactions.forEach(async (t) => {
        try {
          const status = await api.checkTransactionStatus(t.tracker_id);
          if (status !== t.status) {
            setTransactions(api.getStoredTransactions());
          }
        } catch (error) {
          console.error('Error checking transaction status:', error);
        }
      });
    }, 30000);

    return () => clearInterval(interval);
  }, [transactions]);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Updated</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Response Time</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {transactions.map((transaction) => (
            <tr key={transaction.tracker_id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {transaction.tracker_id}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                  ${transaction.status === 'SUCCESS' ? 'bg-green-100 text-green-800' :
                    transaction.status === 'DECLINED' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'}`}>
                  {transaction.status}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {transaction.amount_to_pay} {transaction.currency}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {new Date(transaction.created_at).toLocaleString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {new Date(transaction.updated_at).toLocaleString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {transaction.response_time}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Main Component
export const P2PCISPayment = () => {
  const [currency, setCurrency] = useState('KZT');
  const [method, setMethod] = useState('CARD');
  const [bank, setBank] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const defaultBank = getDefaultBank();
    if (defaultBank) setBank(defaultBank);
  }, [currency, method]);

  const getDefaultBank = () => {
    const currencyConfig = CURRENCIES[currency as keyof typeof CURRENCIES];
    if (!currencyConfig) return '';

    if (typeof currencyConfig.banks === 'object' && !Array.isArray(currencyConfig.banks)) {
      return currencyConfig.banks[method]?.[0] || '';
    }
    return Array.isArray(currencyConfig.banks) ? currencyConfig.banks[0] : '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.createTransaction({
        currency,
        amount: parseFloat(amount),
        sub_method: method,
        bank_token: bank,
        callback_url: 'https://your-callback-url.com/webhook',
        client_transaction_id: `TX_${Date.now()}`,
        client_merchant_id: 'YOUR_MERCHANT_ID',
        customer: {
          ip: '127.0.0.1', // В реальном приложении нужно получать IP клиента
          full_name: 'John Doe'
        }
      });

      setTransaction(response);
      setShowModal(true);
    } catch (error) {
      console.error('Error creating transaction:', error);
      alert('Failed to create transaction. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto space-y-8">
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
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Transaction History
            </h3>
          </div>
          <TransactionsTable />
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