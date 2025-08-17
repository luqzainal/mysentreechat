import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError() {
    // Error parameter not needed here, just return the error state
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // Log error to console in development
    if (import.meta.env.VITE_APP_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // In production, you might want to log to an error reporting service
    // if (import.meta.env.VITE_APP_ENV === 'production') {
    //   // Log to Sentry, LogRocket, etc.
    // }
  }

  resetErrorBoundary = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <CardTitle>Something went wrong</CardTitle>
              <CardDescription>
                We're sorry, but something unexpected happened. Please try refreshing the page or contact support if the problem persists.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {import.meta.env.VITE_APP_ENV === 'development' && (this.state.error || this.state.errorInfo) && (
                <details className="text-sm bg-muted p-4 rounded-md">
                  <summary className="cursor-pointer font-medium mb-2">Error Details (Development Only)</summary>
                  <div className="space-y-2">
                    {this.state.error && (
                      <p><strong>Error:</strong> {this.state.error.toString()}</p>
                    )}
                    {this.state.errorInfo && this.state.errorInfo.componentStack && (
                      <pre className="whitespace-pre-wrap text-xs overflow-auto">
                        <strong>Component Stack:</strong>
                        {this.state.errorInfo.componentStack}
                      </pre>
                    )}
                    {this.state.error && this.state.error.stack && (
                      <pre className="whitespace-pre-wrap text-xs overflow-auto">
                        <strong>Stack Trace:</strong>
                        {this.state.error.stack}
                      </pre>
                    )}
                  </div>
                </details>
              )}
              <div className="flex flex-col space-y-2">
                <Button 
                  onClick={this.resetErrorBoundary} 
                  className="w-full"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => window.location.reload()} 
                  className="w-full"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh Page
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => window.location.href = '/'} 
                  className="w-full"
                >
                  <Home className="mr-2 h-4 w-4" />
                  Go to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;