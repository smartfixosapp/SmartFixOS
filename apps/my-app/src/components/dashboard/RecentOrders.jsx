import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { ArrowRight, Clock } from "lucide-react";

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  in_progress: "bg-blue-100 text-blue-800 border-blue-200",
  waiting_parts: "bg-orange-100 text-orange-800 border-orange-200",
  ready: "bg-green-100 text-green-800 border-green-200",
  completed: "bg-gray-100 text-gray-800 border-gray-200",
  delivered: "bg-slate-100 text-slate-800 border-slate-200"
};

const priorityColors = {
  normal: "bg-slate-100 text-slate-800",
  high: "bg-orange-100 text-orange-800",
  urgent: "bg-red-100 text-red-800"
};

export default function RecentOrders({ orders, loading }) {
  if (loading) {
    return (
      <Card className="shadow-xl border-none">
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center justify-between p-4 border rounded-xl">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-xl border-none">
      <CardHeader className="flex flex-row items-center justify-between border-b">
        <CardTitle className="text-2xl font-bold">Recent Orders</CardTitle>
        <Link to={createPageUrl("Orders")}>
          <Button variant="ghost" size="sm" className="gap-2">
            View All <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="p-6">
        {orders.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 text-lg">No orders yet</p>
            <p className="text-slate-400 text-sm mt-2">Create your first order to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <Link key={order.id} to={createPageUrl(`Orders?order=${order.id}`)}>
                <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:border-cyan-300 hover:shadow-md transition-all duration-200 cursor-pointer bg-white">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-semibold text-slate-800">{order.order_number}</span>
                      <Badge className={statusColors[order.status]} variant="outline">
                        {order.status.replace(/_/g, ' ')}
                      </Badge>
                      {order.priority !== "normal" && (
                        <Badge className={priorityColors[order.priority]} variant="outline">
                          {order.priority}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <span>{order.customer_name}</span>
                      <span>•</span>
                      <span>{order.device_brand} {order.device_model}</span>
                      <span>•</span>
                      <span>{format(new Date(order.created_date), "MMM d, yyyy")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-300"
                          style={{ width: `${order.progress_percentage || 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500 font-medium">{order.progress_percentage || 0}%</span>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-400 ml-4" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
