import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Target, DollarSign, CheckCircle, TrendingUp, AlertCircle } from "lucide-react";

interface DashboardStats {
  totalLeads: number;
  totalCustomers: number;
  totalDeals: number;
  wonDeals: number;
  totalRevenue: number;
  pendingTasks: number;
}

interface UpcomingCall {
  id: string;
  title: string;
  scheduled_at: string;
  call_type: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalLeads: 0,
    totalCustomers: 0,
    totalDeals: 0,
    wonDeals: 0,
    totalRevenue: 0,
    pendingTasks: 0,
  });
  const [loading, setLoading] = useState(true);
  const [upcomingCalls, setUpcomingCalls] = useState<UpcomingCall[]>([]);

  useEffect(() => {
    checkAuth();
    fetchStats();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [leads, customers, deals, tasks, calls] = await Promise.all([
        supabase.from("leads").select("*", { count: "exact" }).eq("user_id", user.id),
        supabase.from("customers").select("*", { count: "exact" }).eq("user_id", user.id),
        supabase.from("deals").select("*").eq("user_id", user.id),
        supabase.from("tasks").select("*", { count: "exact" }).eq("user_id", user.id).eq("status", "pending"),
        supabase.from("calls").select("id, title, scheduled_at, call_type")
          .eq("user_id", user.id)
          .gte("scheduled_at", new Date().toISOString())
          .order("scheduled_at", { ascending: true })
          .limit(5),
      ]);

      const wonDeals = deals.data?.filter((d) => d.stage === "closed_won") || [];
      const totalRevenue = wonDeals.reduce((sum, deal) => sum + (Number(deal.value) || 0), 0);

      setStats({
        totalLeads: leads.count || 0,
        totalCustomers: customers.count || 0,
        totalDeals: deals.data?.length || 0,
        wonDeals: wonDeals.length,
        totalRevenue,
        pendingTasks: tasks.count || 0,
      });
      
      setUpcomingCalls(calls.data || []);
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "Total Leads",
      value: stats.totalLeads,
      icon: Target,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Customers",
      value: stats.totalCustomers,
      icon: Users,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Active Deals",
      value: stats.totalDeals,
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Won Deals",
      value: stats.wonDeals,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Total Revenue",
      value: `₹${stats.totalRevenue.toLocaleString()}`,
      icon: DollarSign,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
    {
      title: "Pending Tasks",
      value: stats.pendingTasks,
      icon: AlertCircle,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your sales overview</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <button
              onClick={() => navigate("/dashboard/leads")}
              className="w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors"
            >
              <div className="font-medium">Add New Lead</div>
              <div className="text-sm text-muted-foreground">Create a new lead entry</div>
            </button>
            <button
              onClick={() => navigate("/dashboard/customers")}
              className="w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors"
            >
              <div className="font-medium">Add New Customer</div>
              <div className="text-sm text-muted-foreground">Register a new customer</div>
            </button>
            <button
              onClick={() => navigate("/dashboard/tasks")}
              className="w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors"
            >
              <div className="font-medium">Create Task</div>
              <div className="text-sm text-muted-foreground">Add a new follow-up task</div>
            </button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Meetings & Calls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingCalls.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming calls scheduled</p>
            ) : (
              upcomingCalls.map((call) => (
                <div key={call.id} className="p-3 border rounded-lg">
                  <div className="font-medium text-sm">{call.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(call.scheduled_at).toLocaleString()} - {call.call_type}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;