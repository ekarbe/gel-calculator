import { useCalculatorContext } from "../../context/CalculatorContext";
import { Settings, Flame } from "lucide-react";
import Card from "../shared/Card";

const CircularProgress = ({ value, max, label, color, subValue, subLabel }) => {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = max && max > 0 
    ? circumference - (Math.min(value, max) / max) * circumference 
    : circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24 mb-3">
        {/* Background Circle */}
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="48"
            cy="48"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            className="text-card-border/50"
          />
          {/* Progress Circle */}
          <circle
            cx="48"
            cy="48"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className={`${color} transition-all duration-1000 ease-out`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black text-text-primary">{Number.isNaN(value) ? 0 : value}</span>
          {subValue && <span className="text-[10px] font-bold text-text-secondary -mt-1">{subValue}</span>}
        </div>
      </div>
      <div className="text-center">
        <div className="text-xs font-bold text-text-primary uppercase tracking-wider">{label}</div>
        {subLabel && <div className="text-[10px] text-text-secondary mt-0.5">{subLabel}</div>}
      </div>
    </div>
  );
};

const BalanceAnalysis = () => {
  const { totals, duration, targetCarbs, electrolyteAnalysis, glucoseParts, fructoseParts, totalCalories } = useCalculatorContext();

  const sodiumMatch = Math.min(100, Math.round(electrolyteAnalysis?.Sodium?.percentage || 0));

  const glucoseCarbs = (totals.glucoseRatio / 100) * targetCarbs;
  const fructoseCarbs = (totals.fructoseRatio / 100) * targetCarbs;

  const formattedRatio = glucoseParts > 0 
    ? `1:${Number((fructoseParts / glucoseParts).toFixed(2))}`
    : `0:1`;

  return (
    <Card className="h-full">
      <div className="flex items-center gap-2 mb-8">
        <Settings size={18} className="text-apple-blue" />
        <h3 className="font-bold text-lg">Activity Summary</h3>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8">
        <CircularProgress 
          value={Math.round((duration / 60) * targetCarbs)} 
          max={((duration / 60) * targetCarbs) * 1.2} 
          label="Total Carbs" 
          subValue="grams"
          color="text-apple-blue" 
          subLabel={`Targeting ${targetCarbs}g/hr`}
        />
        <CircularProgress 
          value={sodiumMatch} 
          max={100} 
          label="Sodium Match" 
          subValue="%"
          color={sodiumMatch < 50 ? "text-red-400" : sodiumMatch < 80 ? "text-orange-400" : "text-[#2dd4bf]"} 
          subLabel={electrolyteAnalysis?.Sodium?.message || "Optimal"}
        />
        <CircularProgress 
          value={Math.round(totalCalories)} 
          max={Math.round(totalCalories) * 1.2} 
          label="Total Energy" 
          subValue="kcal"
          color="text-apple-amber" 
          subLabel="From carbohydrates"
        />
      </div>

      <div className="bg-card-border/20 rounded-2xl p-4 border border-card-border/50">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-bold text-text-secondary">Carb Ratio Limit</span>
          <span className="text-sm font-black text-text-primary">{formattedRatio}</span>
        </div>
        <div className="w-full h-3 bg-card-border/50 rounded-full flex overflow-hidden shadow-inner mb-2">
          <div
            className="h-full bg-apple-primary-blue"
            style={{ width: `${totals.glucoseRatio}%` }}
          ></div>
          <div
            className="h-full bg-orange-400"
            style={{ width: `${totals.fructoseRatio}%` }}
          ></div>
        </div>
        <div className="flex justify-between text-xs font-semibold text-text-secondary">
          <span>Glu: {Math.round(glucoseCarbs)}g/hr</span>
          <span>Fru: {Math.round(fructoseCarbs)}g/hr</span>
        </div>
      </div>

    </Card>
  );
};

export default BalanceAnalysis;
