import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { login } from '@/lib/auth';

export default function LoginPage() {
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        try {
            await login(password);
            toast.success('Ingelogd!');
            navigate('/');
        } catch {
            toast.error('Ongeldig wachtwoord');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <Card className="max-w-md w-full shadow-lg">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold text-center">Factor</CardTitle>
                    <p className="text-center text-gray-500">Voer het wachtwoord in om in te loggen</p>
                </CardHeader>
                <form onSubmit={handleLogin}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="password">Wachtwoord</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <Input
                                    id="password"
                                    type="password"
                                    className="pl-10"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoFocus
                                    required
                                />
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" disabled={busy} className="w-full bg-brand-blue hover:bg-blue-900">
                            {busy ? 'Bezig…' : 'Inloggen'}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
