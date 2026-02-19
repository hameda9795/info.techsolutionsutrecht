import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Mail, Lock, ArrowRight, RefreshCw } from 'lucide-react';
import type { Invoice } from '@/types/invoice';
import { generateVerificationCode } from '@/lib/storage';
import { updateInvoice } from '@/lib/storage';
import { toast } from 'sonner';

interface EmailVerificationProps {
  invoice: Invoice;
  onVerified: () => void;
}

export default function EmailVerification({ invoice, onVerified }: EmailVerificationProps) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [generatedCode, setGeneratedCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();

    if (email.toLowerCase() !== invoice.clientEmail.toLowerCase()) {
      toast.error('Het ingevoerde e-mailadres komt niet overeen met het e-mailadres van de klant!');
      return;
    }

    setIsLoading(true);

    // Generate 6-digit code
    const newCode = generateVerificationCode();
    setGeneratedCode(newCode);

    // Save code
    const updatedInvoice = {
      ...invoice,
      verificationCode: newCode,
      codeExpiry: new Date(Date.now() + 10 * 60 * 1000).toISOString()
    };
    updateInvoice(updatedInvoice);

    try {
      // Send real email via API
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email,
          subject: 'Uw Verificatiecode - TechSolutionsUtrecht',
          html: `
            <div style="font-family: Arial, sans-serif; color: #333;">
              <h2 style="color: #0F172A;">Verificatiecode</h2>
              <p>Gebruik onderstaande code om uw document te bekijken:</p>
              <div style="background: #F1F5F9; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #EA580C;">${newCode}</span>
              </div>
              <p>Deze code is 10 minuten geldig.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <small style="color: #666;">TechSolutionsUtrecht - <a href="https://techsolutionsutrecht.nl" style="color: #EA580C;">techsolutionsutrecht.nl</a></small>
            </div>
          `
        })
      });

      if (!response.ok) {
        throw new Error('Kon email niet verzenden');
      }

      toast.success(`6-cijferige code verzonden naar ${email}!`);
      setStep('code');
      setCountdown(60);
    } catch (error) {
      console.error(error);
      toast.error('Er is een fout opgetreden bij het verzenden van de email via API.');
      // Optional: Fallback to simulation for demo if API fails locally (without env vars)
      // For now, we show error to ensure they set it up. 
      // Or we can just log valid code for local dev:
      console.log('Valid Code for Dev:', newCode);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();

    const enteredCode = code.join('');

    if (enteredCode !== generatedCode) {
      toast.error('Verkeerde code!');
      return;
    }

    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));

    toast.success('Code geverifieerd!');
    onVerified();
    setIsLoading(false);
  };

  const handleResendCode = () => {
    if (countdown > 0) return;

    const newCode = generateVerificationCode();
    setGeneratedCode(newCode);

    const updatedInvoice = {
      ...invoice,
      verificationCode: newCode,
      codeExpiry: new Date(Date.now() + 10 * 60 * 1000).toISOString()
    };
    updateInvoice(updatedInvoice);

    toast.success(`Nieuwe code verzonden! (Demo: ${newCode})`);
    setCountdown(60);
  };

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`code-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      const prevInput = document.getElementById(`code-${index - 1}`);
      prevInput?.focus();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-brand-orange">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-brand-blue rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">Verificatie</CardTitle>
          <CardDescription>
            Om de factuur te bekijken moet u uw e-mailadres verifiëren
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'email' ? (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Voer uw e-mailadres in
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="uw@email.nl"
                    className="pl-10 focus:ring-brand-blue"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  E-mailadres moet overeenkomen met: {invoice.clientEmail}
                </p>
              </div>
              <Button
                type="submit"
                className="w-full bg-brand-blue hover:bg-blue-900"
                disabled={isLoading}
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4 mr-2" />
                )}
                Code Verzenden
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Voer de 6-cijferige code in
                </label>
                <div className="flex justify-center gap-2">
                  {code.map((digit, index) => (
                    <Input
                      key={index}
                      id={`code-${index}`}
                      type="text"
                      inputMode="numeric"
                      value={digit}
                      onChange={(e) => handleCodeChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      className="w-12 h-14 text-center text-xl font-bold focus:ring-brand-orange"
                      maxLength={1}
                      required
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Code verzonden naar {email}
                </p>
              </div>

              <Button
                type="submit"
                className="w-full bg-green-600 hover:bg-green-700"
                disabled={isLoading || code.some(c => !c)}
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4 mr-2" />
                )}
                Verifiëren en Bekijken
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={countdown > 0}
                  className="text-sm text-brand-orange hover:text-orange-600 disabled:text-gray-400 font-medium"
                >
                  {countdown > 0 ? `Opnieuw verzenden over ${countdown}s` : 'Code opnieuw verzenden'}
                </button>
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setStep('email')}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  E-mailadres wijzigen
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
