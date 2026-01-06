import React, { useState } from 'react';
import { cn } from '@/lib/utils';

export default function CalculatorWidget({ isMaximized }) {
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');

  const handleNumber = (num) => {
    setDisplay(display === '0' ? num : display + num);
  };

  const handleOperator = (op) => {
    setEquation(display + ' ' + op + ' ');
    setDisplay('0');
  };

  const handleEquals = () => {
    try {
      const result = eval(equation + display);
      setDisplay(String(result));
      setEquation('');
    } catch {
      setDisplay('Error');
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setEquation('');
  };

  const Button = ({ value, onClick, className, span = 1 }) => (
    <button
      onClick={onClick}
      className={cn(
        "p-3 rounded-xl font-medium transition-all",
        "hover:scale-105 active:scale-95",
        className,
        span === 2 && "col-span-2"
      )}
    >
      {value}
    </button>
  );

  return (
    <div className={cn("flex flex-col", isMaximized && "h-full max-w-md mx-auto")}>
      <div className={cn(
        "text-right mb-4 p-4 rounded-xl bg-white/5",
        isMaximized && "text-2xl"
      )}>
        <div className="text-white/40 text-sm h-5">{equation}</div>
        <div className={`font-light ${isMaximized ? 'text-5xl' : 'text-3xl'}`}>{display}</div>
      </div>

      <div className={cn("grid grid-cols-4 gap-2", isMaximized && "gap-3 flex-1")}>
        <Button value="C" onClick={handleClear} className="bg-rose-500/30 hover:bg-rose-500/40" />
        <Button value="±" onClick={() => setDisplay(String(-parseFloat(display)))} className="bg-white/10 hover:bg-white/20" />
        <Button value="%" onClick={() => setDisplay(String(parseFloat(display) / 100))} className="bg-white/10 hover:bg-white/20" />
        <Button value="÷" onClick={() => handleOperator('/')} className="bg-amber-500/30 hover:bg-amber-500/40" />
        
        <Button value="7" onClick={() => handleNumber('7')} className="bg-white/10 hover:bg-white/20" />
        <Button value="8" onClick={() => handleNumber('8')} className="bg-white/10 hover:bg-white/20" />
        <Button value="9" onClick={() => handleNumber('9')} className="bg-white/10 hover:bg-white/20" />
        <Button value="×" onClick={() => handleOperator('*')} className="bg-amber-500/30 hover:bg-amber-500/40" />
        
        <Button value="4" onClick={() => handleNumber('4')} className="bg-white/10 hover:bg-white/20" />
        <Button value="5" onClick={() => handleNumber('5')} className="bg-white/10 hover:bg-white/20" />
        <Button value="6" onClick={() => handleNumber('6')} className="bg-white/10 hover:bg-white/20" />
        <Button value="-" onClick={() => handleOperator('-')} className="bg-amber-500/30 hover:bg-amber-500/40" />
        
        <Button value="1" onClick={() => handleNumber('1')} className="bg-white/10 hover:bg-white/20" />
        <Button value="2" onClick={() => handleNumber('2')} className="bg-white/10 hover:bg-white/20" />
        <Button value="3" onClick={() => handleNumber('3')} className="bg-white/10 hover:bg-white/20" />
        <Button value="+" onClick={() => handleOperator('+')} className="bg-amber-500/30 hover:bg-amber-500/40" />
        
        <Button value="0" onClick={() => handleNumber('0')} className="bg-white/10 hover:bg-white/20" span={2} />
        <Button value="." onClick={() => handleNumber('.')} className="bg-white/10 hover:bg-white/20" />
        <Button value="=" onClick={handleEquals} className="bg-emerald-500/30 hover:bg-emerald-500/40" />
      </div>
    </div>
  );
}
