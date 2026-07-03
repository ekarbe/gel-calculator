import { useCalculatorContext } from "../../context/CalculatorContext";
import { Clock, Droplets, Zap, Coffee, CheckCircle2 } from "lucide-react";
import Card from "../shared/Card";

const VisualTimeline = () => {
  const { duration, strategy, gelsPerHour } = useCalculatorContext();

  if (!strategy.isSmartSuggestions) return null;

  const durationHours = duration / 60;
  const strat = strategy.suggestedStrategies;
  
  const events = [];
  
  if (strat.caffeineStrategy && strat.caffeineStrategy.preRace > 0) {
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
    desc: "Begin continuous fueling strategy",
    color: "bg-blue-100 text-blue-600 border-blue-200",
    icon: <Clock size={16} />
  });

  events.push({
    time: "Continuous",
    type: "carbs",
    title: `Carbohydrates (${strat.carbsPerHour}g/hr)`,
    desc: `Consume ${gelsPerHour} gel${gelsPerHour > 1 ? 's' : ''}/hr (${strat.targetRatio.glucose}:${strat.targetRatio.fructose} glucose:fructose ratio)`,
    color: "bg-yellow-100 text-yellow-600 border-yellow-200",
    icon: <Zap size={16} />
  });
  
  events.push({
    time: "Continuous",
    type: "hydration",
    title: `Hydration (${strat.sweatRate.toFixed(2)} L/hr)`,
    desc: "Drink to match estimated sweat rate",
    color: "bg-cyan-100 text-cyan-600 border-cyan-200",
    icon: <Droplets size={16} />
  });

  if (strat.caffeineStrategy && strat.caffeineStrategy.intraRacePerHour > 0) {
    if (strat.caffeineStrategy.delayStartHours > 0) {
      events.push({
        time: `T+${strat.caffeineStrategy.delayStartHours} hrs`,
        type: "caffeine",
        title: "Begin Caffeine Maintenance",
        desc: `${Math.round(strat.caffeineStrategy.intraRacePerHour)}mg/hr to combat fatigue`,
        color: "bg-amber-100 text-amber-600 border-amber-200",
        icon: <Coffee size={16} />
      });
    } else {
      events.push({
        time: "Continuous",
        type: "caffeine",
        title: "Caffeine Maintenance",
        desc: `${Math.round(strat.caffeineStrategy.intraRacePerHour)}mg/hr`,
        color: "bg-amber-100 text-amber-600 border-amber-200",
        icon: <Coffee size={16} />
      });
    }
  }

  events.push({
    time: `T+${durationHours.toFixed(1)} hrs`,
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
