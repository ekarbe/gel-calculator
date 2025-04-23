import React from 'react';
import { Card, CardContent } from "@/components/ui/card";

interface BasicInputsProps {
    hours: number;
    setHours: (value: number) => void;
    carbsPerHour: number;
    setCarbsPerHour: (value: number) => void;
    totalCarbsNeeded: number;
}

const BasicInputs: React.FC<BasicInputsProps> = ({
    hours,
    setHours,
    carbsPerHour,
    setCarbsPerHour,
    totalCarbsNeeded
}) => {
    return (
        <Card>
            <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row justify-center gap-4 sm:gap-8">
                    <div className="space-y-2 text-center">
                        <label htmlFor="duration" className="text-sm font-medium">Duration (hours)</label>
                        <input
                            id="duration"
                            type="number"
                            value={hours}
                            onChange={(e) => setHours(Math.max(0.1, Number(e.target.value)))}
                            className="input-number text-center w-full sm:w-20"
                            min="0.1"
                            step="0.1"
                        />
                    </div>
                    <div className="space-y-2 text-center">
                        <label htmlFor="carbsPerHour" className="text-sm font-medium">Target Carbs per Hour</label>
                        <input
                            id="carbsPerHour"
                            type="number"
                            value={carbsPerHour}
                            onChange={(e) => setCarbsPerHour(Math.max(0, Number(e.target.value)))}
                            className="input-number text-center w-full sm:w-20"
                            min="0"
                        />
                    </div>
                </div>
                <div className="text-center mt-4 text-sm font-medium">
                    Total Target Carbs: {totalCarbsNeeded.toFixed(1)}g
                </div>
            </CardContent>
        </Card>
    );
};

export default BasicInputs;
