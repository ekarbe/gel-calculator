import { useCalculatorContext } from "../../context/CalculatorContext";
import { Clock, Droplets, Zap, Coffee, CheckCircle2, List, Table } from "lucide-react";
import Card from "../shared/Card";
import { SWEAT_RATES } from "../../constants/constants";
import { useState } from "react";

const VisualTimeline = () => {
  const { duration, strategy, gelsPerHour, sweatRate, isSweatRate } = useCalculatorContext();
  const [viewMode, setViewMode] = useState('timeline'); // 'timeline' or 'table'

  const durationHours = duration / 60;
  const strat = strategy.suggestedStrategies;
  
  const events = [];
  
  const gelInterval = gelsPerHour > 0 ? 60 / gelsPerHour : 0;
  const effectiveSweatRate = strategy.isSmartSuggestions 
    ? strat.sweatRate 
    : (isSweatRate ? SWEAT_RATES[sweatRate] : 0);
  
  const hydrationPerChunk = effectiveSweatRate > 0 && gelInterval > 0 
    ? (effectiveSweatRate * 1000 * (gelInterval / 60)) 
    : 0;

  if (strategy.isSmartSuggestions && strat.bicarbStrategy && strat.bicarbStrategy.preRaceDoseMg > 0) {
    events.push({
      time: "T-90 min",
      type: "bicarb",
      title: "Pre-race Bicarbonate",
      desc: `${Math.round(strat.bicarbStrategy.preRaceDoseMg / 1000)}g (yields ${Math.round(strat.bicarbStrategy.sodiumLoadMg)}mg Na+)`,
      color: "bg-apple-blue/20 text-apple-blue border-apple-blue/30",
      icon: <div className="font-black text-[10px]">Na</div>
    });
  }

  if (strategy.isSmartSuggestions && strat.caffeineStrategy && strat.caffeineStrategy.preRace > 0) {
    events.push({
      time: "T-60 min",
      type: "caffeine",
      title: "Pre-race Caffeine Bolus",
      desc: `${Math.round(strat.caffeineStrategy.preRace)}mg`,
      color: "bg-amber-100 text-apple-amber border-amber-200",
      icon: <Coffee size={16} />
    });
  }
  
  events.push({
    time: "T=0 (Start)",
    type: "start",
    title: "Activity Start",
    desc: `Begin activity.${gelsPerHour > 0 ? ' Take 1st Gel.' : ''}`,
    color: "bg-apple-greenlue-100 text-apple-greenlue-600 border-blue-200",
    icon: <Clock size={16} />
  });

  if (gelsPerHour > 0) {
    for (let t = gelInterval; t < duration; t += gelInterval) {
      let desc = `Take 1 Gel`;
      if (hydrationPerChunk > 0) {
        desc += ` + Drink ${Math.round(hydrationPerChunk)}ml`;
      }
      
      if (strategy.isSmartSuggestions && strat.caffeineStrategy && strat.caffeineStrategy.intraRacePerHour > 0) {
        if (t >= strat.caffeineStrategy.delayStartHours * 60) {
          const caffeineAmount = strat.caffeineStrategy.intraRacePerHour * (gelInterval / 60);
          desc += ` + ${Math.round(caffeineAmount)}mg Caff.`;
        }
      }
      
      const hours = Math.floor(t / 60);
      const mins = Math.round(t % 60);
      let timeStr = "";
      if (hours > 0) {
        timeStr = `T+${hours}h${mins > 0 ? ` ${mins}m` : ''}`;
      } else {
        timeStr = `T+${mins}m`;
      }
      
      events.push({
        time: timeStr,
        type: "fuel",
        title: "Fuel & Hydrate",
        desc: desc,
        color: "bg-yellow-100 text-yellow-600 border-yellow-200",
        icon: <Zap size={16} />
      });
    }
  } else if (effectiveSweatRate > 0) {
    events.push({
      time: "Continuous",
      type: "hydration",
      title: "Hydration Only",
      desc: `Drink ${Math.round(effectiveSweatRate * 1000)}ml per hour`,
      color: "bg-apple-blueyan-100 text-apple-blueyan-600 border-cyan-200",
      icon: <Droplets size={16} />
    });
  }

  const finishHours = Math.floor(duration / 60);
  const finishMins = Math.round(duration % 60);
  const finishTimeStr = finishHours > 0 ? `T+${finishHours}h${finishMins > 0 ? ` ${finishMins}m` : ''}` : `T+${finishMins}m`;

  events.push({
    time: finishTimeStr,
    type: "finish",
    title: "Finish",
    desc: "Begin recovery",
    color: "bg-green-100 text-green-600 border-green-200",
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
          >
            <List size={18} />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-card text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
            title="Table View"
          >
            <Table size={18} />
          </button>
        </div>
      </div>
      
      {viewMode === 'timeline' ? (
        <div className="relative border-l-2 border-card-border ml-4 pl-6 space-y-8 mt-4">
          {events.map((event, index) => (
            <div key={index} className="relative">
              <div className={`absolute -left-[37px] top-1 w-8 h-8 rounded-full border-2 bg-card flex items-center justify-center ${event.color}`}>
                {event.icon}
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-text-secondary block mb-1">
                  {event.time}
                </span>
                <h3 className="text-md font-bold text-text-primary">{event.title}</h3>
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
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border bg-card ${event.color}`}>
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
    </Card>
  );
};

export default VisualTimeline;
