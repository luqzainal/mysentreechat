import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// import { Slider } from "@/components/ui/slider"; // Component tidak wujud, guna HTML input range
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, Zap, Eye, EyeOff, Settings, Thermometer } from 'lucide-react';
import api from '../services/api'; // Import API service
import { useAuth } from '../contexts/AuthContext';

// Import Refresh Button
import RefreshButton from '../components/RefreshButton';

function SettingsPage() {
  const { user } = useAuth();
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('gpt-3.5-turbo');
  const [temperature, setTemperature] = useState([0.7]);
  const [maxTokens, setMaxTokens] = useState(1000);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testMessage, setTestMessage] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [availableModels, setAvailableModels] = useState([]);
  const [showApiKey, setShowApiKey] = useState(false);
  const [lastTestStatus, setLastTestStatus] = useState(null);

  useEffect(() => {
      const fetchSettings = async () => {
        setIsLoading(true);
        try {
           const response = await api.get('/settings/ai'); 
           setOpenaiApiKey(response.data.openaiApiKey || '');
           setSelectedModel(response.data.aiModel || 'gpt-3.5-turbo');
           setTemperature([response.data.aiTemperature || 0.7]);
           setMaxTokens(response.data.aiMaxTokens || 1000);
           if (response.data.openaiApiKey) {
             setLastTestStatus('saved');
           }
         } catch (error) {
           console.error("Failed to fetch AI settings:", error);
           toast.error("Failed to load AI settings");
         } finally {
           setIsLoading(false);
         }
       };

      if(user) {
          fetchSettings();
      }

  }, [user]);

  const handleSaveSettings = async () => {
    if (!openaiApiKey || !openaiApiKey.startsWith('sk-')) {
      toast.error("Please enter a valid OpenAI API key (starts with 'sk-')");
      return;
    }

    setIsSaving(true);
    toast.info("Saving AI settings...");

    try {
      await api.put('/settings/ai', { 
        openaiApiKey,
        aiModel: selectedModel,
        aiTemperature: temperature[0],
        aiMaxTokens: maxTokens
      });
      toast.success("AI settings saved successfully.");
      setLastTestStatus('saved');
    } catch (error) {
       console.error("Failed to save AI settings:", error);
       const errorMessage = error.response?.data?.message || "Error saving settings.";
       toast.error(`Save failed: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    const keyToTest = openaiApiKey.trim();
    if (!keyToTest) {
      toast.error("Please enter an API key to test");
      return;
    }

    if (!keyToTest.startsWith('sk-')) {
      toast.error("Invalid API key format. OpenAI keys start with 'sk-'");
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    toast.info("Testing API connection...");

    try {
      const response = await api.post('/settings/ai/test', {
        apiKey: keyToTest,
        testMessage: testMessage || undefined
      });

      if (response.data.success) {
        setTestResult({
          success: true,
          message: response.data.message,
          data: response.data.data
        });
        setLastTestStatus('success');
        toast.success("🎉 API connection successful!");
        
        // Load available models
        try {
          const modelsResponse = await api.get('/settings/ai/models');
          if (modelsResponse.data.success) {
            setAvailableModels(modelsResponse.data.models);
          }
        } catch (modelError) {
          console.error("Failed to fetch models:", modelError);
        }
      }
    } catch (error) {
      console.error("API test failed:", error);
      const errorData = error.response?.data;
      const errorMessage = errorData?.message || "Connection test failed";
      
      setTestResult({
        success: false,
        message: errorMessage,
        errorCode: errorData?.errorCode,
        details: errorData?.details
      });
      setLastTestStatus('error');
      
      if (errorData?.errorCode === 'INVALID_API_KEY') {
        toast.error("❌ Invalid API key. Please check your OpenAI key.");
      } else if (errorData?.errorCode === 'INSUFFICIENT_CREDITS') {
        toast.error("💳 Insufficient credits. Please check your OpenAI billing.");
      } else if (errorData?.errorCode === 'RATE_LIMIT_EXCEEDED') {
        toast.error("⏱️ Rate limit exceeded. Try again later.");
      } else {
        toast.error(`❌ ${errorMessage}`);
      }
    } finally {
      setIsTesting(false);
    }
  };

  const getStatusIcon = () => {
    switch (lastTestStatus) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'saved':
        return <CheckCircle2 className="h-4 w-4 text-blue-600" />;
      default:
        return null;
    }
  };

  if (isLoading) {
      return <div className="container mx-auto p-4">Loading settings...</div>;
  }

  const refreshSettings = () => {
    window.location.reload();
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Settings</h1>
        <RefreshButton onRefresh={refreshSettings} position="relative" />
      </div>

      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-orange-500" />
            AI Configuration
            {getStatusIcon()}
          </CardTitle>
          <CardDescription>
            Manage your OpenAI API key for AI chatbot features. Test your connection to ensure everything works properly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* API Key Input Section */}
          <div className="space-y-2">
            <Label htmlFor="openaiApiKey" className="flex items-center gap-2">
              OpenAI API Key
              <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="openaiApiKey"
                name="openaiApiKey"
                type={showApiKey ? "text" : "password"}
                placeholder="Enter your OpenAI API key (e.g., sk-...)"
                value={openaiApiKey}
                onChange={(e) => {
                  setOpenaiApiKey(e.target.value);
                  setTestResult(null);
                  setLastTestStatus(null);
                }}
                disabled={isSaving || isTesting}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-8 w-8 p-0"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Your API key is stored securely. Get your key from{' '}
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline text-blue-600">
                OpenAI Dashboard
              </a>.
            </p>
          </div>

          {/* AI Model Configuration Section */}
          <div className="border rounded-lg p-4 bg-gradient-to-r from-blue-50 to-purple-50">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-blue-800">AI Model Configuration</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Model Selection */}
              <div className="space-y-2">
                <Label htmlFor="aiModel">AI Model</Label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger id="aiModel">
                    <SelectValue placeholder="Select AI model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-3.5-turbo">
                      <div className="flex flex-col">
                        <span className="font-medium">GPT-3.5 Turbo</span>
                        <span className="text-xs text-muted-foreground">Fast, cost-effective, good for most tasks</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="gpt-4">
                      <div className="flex flex-col">
                        <span className="font-medium">GPT-4</span>
                        <span className="text-xs text-muted-foreground">Most capable, better reasoning, higher cost</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="gpt-4-turbo">
                      <div className="flex flex-col">
                        <span className="font-medium">GPT-4 Turbo</span>
                        <span className="text-xs text-muted-foreground">Latest GPT-4, faster and more efficient</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="gpt-4o">
                      <div className="flex flex-col">
                        <span className="font-medium">GPT-4o</span>
                        <span className="text-xs text-muted-foreground">Multimodal flagship model</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="gpt-4o-mini">
                      <div className="flex flex-col">
                        <span className="font-medium">GPT-4o Mini</span>
                        <span className="text-xs text-muted-foreground">Affordable and intelligent small model</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Different models have different capabilities and costs. GPT-3.5 is recommended for most use cases.
                </p>
              </div>

              {/* Max Tokens */}
              <div className="space-y-2">
                <Label htmlFor="maxTokens">Max Tokens</Label>
                <Input
                  id="maxTokens"
                  type="number"
                  min="100"
                  max="4000"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value) || 1000)}
                  placeholder="1000"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum number of tokens in AI responses (100-4000)
                </p>
              </div>
            </div>

            {/* Temperature Control */}
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Thermometer className="h-4 w-4 text-purple-600" />
                  <Label htmlFor="temperature">Creativity Level (Temperature)</Label>
                </div>
                <span className="text-sm font-mono bg-purple-100 px-2 py-1 rounded">
                  {temperature[0]}
                </span>
              </div>
              
              <div className="space-y-2">
                <input
                  id="temperature"
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={temperature[0]}
                  onChange={(e) => setTemperature([parseFloat(e.target.value)])}
                  className="w-full h-2 bg-gradient-to-r from-blue-200 to-purple-200 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #dbeafe 0%, #e0e7ff ${temperature[0] * 100}%, #f3f4f6 ${temperature[0] * 100}%, #f3f4f6 100%)`
                  }}
                />
                
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0.0 - Conservative</span>
                  <span>0.5 - Balanced</span>
                  <span>1.0 - Creative</span>
                </div>
              </div>
              
              <div className="p-3 bg-white border rounded-md">
                <div className="text-xs space-y-1">
                  <p className="font-semibold text-purple-700">Temperature Guide:</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center p-2 bg-blue-50 rounded">
                      <p className="font-medium">0.0 - 0.3</p>
                      <p className="text-muted-foreground">Conservative</p>
                      <p>Consistent, predictable responses</p>
                    </div>
                    <div className="text-center p-2 bg-green-50 rounded">
                      <p className="font-medium">0.4 - 0.7</p>
                      <p className="text-muted-foreground">Balanced</p>
                      <p>Good mix of consistency and variety</p>
                    </div>
                    <div className="text-center p-2 bg-purple-50 rounded">
                      <p className="font-medium">0.8 - 1.0</p>
                      <p className="text-muted-foreground">Creative</p>
                      <p>More varied, creative responses</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Test Connection Section */}
          <div className="border rounded-lg p-4 bg-slate-50">
            <h3 className="font-semibold mb-3">Test API Connection</h3>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="testMessage">Custom Test Message (Optional)</Label>
                <Textarea
                  id="testMessage"
                  placeholder="Enter a custom message to test the AI response (leave blank for default test)"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  rows={2}
                  disabled={isTesting}
                />
              </div>
              <Button 
                onClick={handleTestConnection} 
                disabled={isTesting || !openaiApiKey}
                variant="outline"
                className="w-full"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing Connection...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Test API Connection
                  </>
                )}
              </Button>
            </div>

            {/* Test Results */}
            {testResult && (
              <div className={`mt-4 p-4 rounded-md ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {testResult.success ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  <h4 className={`font-semibold ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
                    {testResult.success ? 'Connection Successful!' : 'Connection Failed'}
                  </h4>
                </div>
                <p className={`text-sm ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                  {testResult.message}
                </p>
                
                {testResult.success && testResult.data && (
                  <div className="mt-3 text-xs text-green-600 space-y-1">
                    <div><strong>AI Response:</strong> {testResult.data.response}</div>
                    <div><strong>Model:</strong> {testResult.data.model}</div>
                    <div><strong>Tokens Used:</strong> {testResult.data.tokensUsed}</div>
                    <div><strong>Response Time:</strong> {testResult.data.responseTime}</div>
                  </div>
                )}

                {!testResult.success && testResult.errorCode && (
                  <div className="mt-2 text-xs text-red-600">
                    <div><strong>Error Code:</strong> {testResult.errorCode}</div>
                    {testResult.details && <div><strong>Details:</strong> {testResult.details}</div>}
                  </div>
                )}
              </div>
            )}

            {/* Available Models */}
            {availableModels.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <h4 className="font-semibold text-blue-800 mb-2">Available AI Models</h4>
                <div className="flex flex-wrap gap-2">
                  {availableModels.slice(0, 6).map(model => (
                    <span key={model.id} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                      {model.id}
                    </span>
                  ))}
                  {availableModels.length > 6 && (
                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                      +{availableModels.length - 6} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex gap-3">
          <Button 
            onClick={handleSaveSettings} 
            disabled={isSaving || !openaiApiKey || isTesting}
            className="flex-1"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save AI Settings'
            )}
          </Button>
          
          <Button 
            variant="outline" 
            onClick={handleTestConnection}
            disabled={isTesting || !openaiApiKey || isSaving}
          >
            {isTesting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Usage Guidelines Card */}
      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle>AI Usage Guidelines</CardTitle>
          <CardDescription>Important information about using AI features</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>• <strong>API Key Security:</strong> Your API key is stored securely and only used for your AI chatbot features.</div>
          <div>• <strong>Usage Billing:</strong> AI requests will be charged to your OpenAI account based on token usage and model selected.</div>
          <div>• <strong>Model Selection:</strong> GPT-3.5-turbo is recommended for cost-effective operations. GPT-4 models provide better quality but cost more.</div>
          <div>• <strong>Temperature Setting:</strong> Lower values (0.0-0.3) give consistent responses, higher values (0.7-1.0) give more creative responses.</div>
          <div>• <strong>Token Limits:</strong> Higher max tokens allow longer responses but increase costs per request.</div>
          <div>• <strong>Rate Limits:</strong> OpenAI has rate limits based on your account tier and usage.</div>
          <div>• <strong>Content Policy:</strong> Ensure your AI chatbot content complies with OpenAI's usage policies.</div>
        </CardContent>
      </Card>

    </div>
  );
}

export default SettingsPage; 