import React from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

const RefreshButton = ({ onRefresh, position = 'fixed' }) => {
  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    } else {
      window.location.reload();
    }
  };

  const baseClasses = "flex items-center gap-2 transition-all duration-200";
  
  const positionClasses = position === 'fixed' 
    ? "fixed top-[5rem] left-4 z-40 bg-background/95 backdrop-blur-sm border shadow-lg hover:shadow-xl md:left-6 rounded-md"
    : "bg-background border shadow-sm hover:shadow-md rounded-md";

  return (
    <Button
      onClick={handleRefresh}
      variant="outline"
      size="sm"
      className={`${baseClasses} ${positionClasses}`}
    >
      <RotateCcw className="h-4 w-4" />
      <span className="hidden xs:inline sm:inline">Refresh</span>
    </Button>
  );
};

export default RefreshButton;