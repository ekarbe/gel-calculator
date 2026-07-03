import { useCalculatorContext } from "../../context/CalculatorContext";
import { Clock, Droplets, Zap, Coffee, CheckCircle2 } from "lucide-react";
import Card from "../shared/Card";
import { SWEAT_RATES } from "../../constants/constants";

const VisualTimeline = () => {
  const { duration, strategy, gelsPerHour, sweatRate, isSweatRate } = useCalculatorContext();



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

  if (strategy.isSmartSuggestions && strat.caffeineStrategy && strat.caffeineStrategy.preRace > 0) {
    events.push({
      time: "T-60 min",
      type: "caffeine",
      title: "Pre-race Caffeine Bolus",
      desc: `${Math.round(strat.caffeineStrategy.preRace)}mg`,
      color: "bg-amber-100 text-amber-600 border-amber-200",
      icon: <Coffee size={16} />
    });
  }
  
  events.push({
    time: "T=0 (Start)",
    type: "start",
    title: "Activity Start",
    desc: `Begin activity.${gelsPerHour > 0 ? ' Take 1st Gel.' : ''}`,
    color: "bg-blue-100 text-blue-600 border-blue-200",
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
      color: "bg-cyan-100 text-cyan-600 border-cyan-200",
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
      <div className="mb-6">
        <h2 className="text-lg font-bold text-slate-900">Execution Timeline</h2>
        <p className="text-sm text-slate-600">Your personalized physiological strategy timeline</p>
      </div>
      
      <div className="relative border-l-2 border-slate-100 ml-4 pl-6 space-y-8">
        {events.map((event, index) => (
          <div key={index} className="relative">
            <div className={`absolute -left-[37px] top-1 w-8 h-8 rounded-full border-2 bg-white flex items-center justify-center ${event.color}`}>
              {event.icon}
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                {event.time}
              </span>
              <h3 className="text-md font-bold text-slate-800">{event.title}</h3>
              <p className="text-sm text-slate-600 mt-1">{event.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default VisualTimeline;
