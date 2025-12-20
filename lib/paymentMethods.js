import { DollarSign, CreditCard , Smartphone} from 'lucide-react';

export const methodMap = {
  bank_transfer: {
    name: 'Bank Transfer',
    icon: <DollarSign className="w-4 h-4" />,
    color: 'blue'
  },
  airtel_money: {
    name: 'Airtel Money',
    icon: <Smartphone className="w-4 h-4" />,
    color: 'purple'
  },
  mpamba: {
    name: 'Mpamba',
    icon: <DollarSign className="w-4 h-4" />,
    color: 'green'
  },
  cash: {
    name: 'Cash',
    icon: <DollarSign className="w-4 h-4" />,
    color: 'red'
  },
  paychangu: {
    name: 'PayChangu',
    icon: <CreditCard className="w-4 h-4" />,
    color: 'green'
  }
};

export const getPaymentMethodName = (method) => {
  return methodMap[method]?.name || '-';
};

export const getPaymentMethodIcon = (method) => {
  return methodMap[method]?.icon || <DollarSign className="w-4 h-4" />;
};
export const getPaymentMethodColor = (method) => {
  return methodMap[method]?.color || 'green';
};
export const paymentMethods = Object.entries(methodMap).map(([key, value]) => ({
  key,
  ...value
}));