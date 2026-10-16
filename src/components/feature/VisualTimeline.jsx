import { useCalculatorContext } from "../../context/CalculatorContext";
import { Clock, Droplets, Zap, Coffee, CheckCircle2, List, Table, Info } from "lucide-react";
import Card from "../shared/Card";
import { SWEAT_RATES } from "../../constants/constants";
import { getGelTimes, formatElapsed } from "../../lib/schedule";
import { getSuggestedFluidMlPerHour, FLUID_ADVICE } from "../../lib/safety";
import { useState } from "react";

const VisualTimeline = () => {
  const { duration, strategy, gelsPerHour, sweatRate, isSweatRate } = useCalculatorContext();
  const [viewMode, setViewMode] = useState('timeline'); // 'timeline' or 'table'

  const strat = strategy.suggestedStrategies;

  const events = [];

  const gelTimes = getGelTimes(duration, gelsPerHour);
  const gelInterval = gelsPerHour > 0 ? 60 / gelsPerHour : 0;
  const effectiveSweatRate = strategy.isSmartSuggestions
    ? strat.sweatRate
    : (isSweatRate ? SWEAT_RATES[sweatRate] : 0);

  const drinkPerHour = getSuggestedFluidMlPerHour(effectiveSweatRate);
  const drinkPerGel = drinkPerHour > 0 && gelInterval > 0 ? drinkPerHour * (gelInterval / 60) : 0;

  if (strategy.isSmartSuggestions && strat.bicarbStrategy && strat.bicarbStrategy.preRaceDoseMg > 0) {
    events.push({
      time: "T-90 min",
      type: "bicarb",
      title: "Pre-race Bicarbonate",
      desc: `${Math.round(strat.bicarbStrategy.preRaceDoseMg / 1000)}g (adds ${(strat.bicarbStrategy.sodiumLoadMg / 1000).toFixed(1)}g sodium). Trial it in training first: GI distress is common.`,
      color: "text-apple-purple border-apple-purple/40",
      icon: <div className="font-black text-[10px]">Na</div>
    });
  }

  if (strategy.isSmartSuggestions && strat.caffeineStrategy && strat.caffeineStrategy.preRace > 0) {
    events.push({
      time: "T-60 min",
      type: "caffeine",
      title: "Pre-race Caffeine Bolus",
      desc: `${Math.round(strat.caffeineStrategy.preRace)}mg`,
      color: "text-apple-amber border-apple-amber/40",
      icon: <Coffee size={16} />
    });
  }

  events.push({
    time: "T=0 (Start)",
    type: "start",
    title: "Activity Start",
    desc: `Begin activity.${gelTimes.length > 0 ? ' Take 1st Gel.' : ''}`,
    color: "text-text-secondary border-card-border",
    icon: <Clock size={16} />
  });

  gelTimes.slice(1).forEach((t) => {
    let desc = `Take 1 Gel`;
    if (drinkPerGel > 0) {
      desc += ` + ~${Math.round(drinkPerGel)}ml fluid`;
    }

    if (strategy.isSmartSuggestions && strat.caffeineStrategy && strat.caffeineStrategy.intraRacePerHour > 0) {
      if (t >= strat.caffeineStrategy.delayStartHours * 60) {
        const caffeineAmount = strat.caffeineStrategy.intraRacePerHour * (gelInterval / 60);
        desc += ` + ${Math.round(caffeineAmount)}mg Caff.`;
      }
    }

    events.push({
      time: formatElapsed(t),
      type: "fuel",
      title: "Fuel & Hydrate",
      desc: desc,
      color: "text-apple-blue border-apple-blue/40",
      icon: <Zap size={16} />
    });
  });

  if (gelTimes.length === 0 && drinkPerHour > 0) {
    events.push({
      time: "Continuous",
      type: "hydration",
      title: "Hydration Only",
      desc: `Drink to thirst, about ${Math.round(drinkPerHour)}ml per hour`,
      color: "text-apple-teal border-apple-teal/40",
      icon: <Droplets size={16} />
    });
  }

  events.push({
    time: formatElapsed(duration),
    type: "finish",
    title: "Finish",
    desc: "Begin recovery",
    color: "text-apple-green border-apple-green/40",
    icon: <CheckCircle2 size={16} />
  });

  return (
    <Card>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-text-primary">Execution Schedule</h2>
          <p className="text-sm text-text-secondary">Your personalized strategy</p>
        </div>
        <div className="flex bg-card-border/50 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('timeline')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'timeline' ? 'bg-card text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
            title="Timeline View"
            aria-label="Timeline view"
          >
            <List size={18} />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-card text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
            title="Table View"
            aria-label="Table view"
          >
            <Table size={18} />
          </button>
        </div>
      </div>
      
      {viewMode === 'timeline' ? (
        <div className="relative border-l-2 border-card-border ml-4 pl-6 space-y-8 mt-4">
          {events.map((event, index) => (
            <div key={index} className="relative">
              <div className={`absolute -left-[37px] top-1 w-8 h-8 rounded-full border-2 bg-modal flex items-center justify-center ${event.color}`}>
                {event.icon}
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-text-secondary block mb-1">
                  {event.time}
                </span>
                <h3 className="text-base font-bold text-text-primary">{event.title}</h3>
                <p className="text-sm text-text-secondary mt-1">{event.desc}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-card-border">
                <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-text-secondary">Time</th>
                <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-text-secondary">Action</th>
                <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-text-secondary">Details</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event, index) => (
                <tr key={index} className="border-b border-card-border/50 hover:bg-card-border/20 transition-colors">
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="text-sm font-bold text-text-primary">{event.time}</span>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border bg-modal ${event.color}`}>
                      {/* Scale icon down slightly for table */}
                      <div className="scale-75">{event.icon}</div>
                    </div>
                    <span className="text-sm font-medium text-text-primary">{event.title}</span>
                  </td>
                  <td className="py-3 px-4 text-sm text-text-secondary min-w-[200px]">
                    {event.desc}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {drinkPerHour > 0 && (
        <p className="mt-6 text-xs text-text-secondary flex gap-2 items-start">
          <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          {FLUID_ADVICE}
        </p>
      )}
    </Card>
  );
};

export default VisualTimeline;
