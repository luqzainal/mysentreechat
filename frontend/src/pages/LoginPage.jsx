import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MessageSquare } from 'lucide-react'; // Ganti Wave dengan MessageSquare

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data } = await api.post('/users/login', { email, password });
      login(data, data.token);
      // Redirect handled by AuthProvider/MainLayout
    } catch (err) {
      setError(
        err.response?.data?.message || 'Failed to log in. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center text-gray-900 px-4">
      <div className="w-full max-w-md">
        {/* Wrap content in a card */}
        <div className="bg-white p-8 rounded-lg shadow-md space-y-8">
          {/* Logo Placeholder */}
          <div className="flex justify-center">
            <MessageSquare className="h-10 w-auto text-indigo-500" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight">
            Sign in to your account
          </h2>
          
          {/* Display error message if exists */}
          {error && (
            <Alert variant="destructive" className="bg-red-100 border-red-400 text-red-700">
              <AlertTitle>Login Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4 rounded-md shadow-sm">
              <div>
                <Label htmlFor="email-address" className="sr-only"> {/* Hide label visually, keep for accessibility */}
                  Email address
                </Label>
                <span className="text-sm font-medium text-gray-700 block mb-1">Email address</span> {/* Custom visible label */}
                <Input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="relative block w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:z-10 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div>
                  <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="sr-only"> {/* Hide label visually */}
                        Password
                      </Label>
                       <span className="text-sm font-medium text-gray-700 block mb-1">Password</span> {/* Custom visible label */}
                       <div className="text-sm">
                          <a href="#" className="font-medium text-indigo-600 hover:text-indigo-500"> {/* Placeholder link */}
                            Forgot password?
                          </a>
                       </div>
                  </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="relative block w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:z-10 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <Button
                type="submit"
                className="group relative flex w-full justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-white"
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Sign in'}
              </Button>
            </div>
          </form>
          <p className="mt-6 text-center text-sm text-gray-500">
            Not a member?{' '}
            <Link to="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
               Register Now!
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage; 