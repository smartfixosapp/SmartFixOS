import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Clock, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { differenceInDays } from "date-fns";

export default function AlertsPanel({ overdueOrders, highPriorityOrders }) {
  return (
    <Card className="border-l-4 border-l-red-500 shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5" />
          Alerts & Notifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {overdueOrders.length > 0 && (
          <Alert className="border-orange-200 bg-orange-50">
            <Clock className="h-4 w-4 text-orange-600" />
            <AlertDescription className="ml-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-orange-800">
                  {overdueOrders.length} order{overdueOrders.length > 1 ? 's' : ''} overdue (2+ weeks)
                </span>
                <Link to={createPageUrl("Orders?filter=overdue")}>
                  <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200 cursor-pointer hover:bg-orange-200">
                    View
                  </Badge>
                </Link>
              </div>
              <div className="mt-2 space-y-1">
                {overdueOrders.slice(0, 3).map(order => (
                  <div key={order.id} className="text-sm text-orange-700">
                    {order.order_number} - {differenceInDays(new Date(), new Date(order.created_date))} days old
                  </div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {highPriorityOrders.length > 0 && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="ml-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-red-800">
                  {highPriorityOrders.length} high priority order{highPriorityOrders.length > 1 ? 's' : ''} pending
                </span>
                <Link to={createPageUrl("Orders?filter=priority")}>
                  <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200 cursor-pointer hover:bg-red-200">
                    View
                  </Badge>
                </Link>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
