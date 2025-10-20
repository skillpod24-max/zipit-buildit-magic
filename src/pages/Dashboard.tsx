import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Target, DollarSign, CheckCircle, TrendingUp, AlertCircle, UserPlus, Phone, FileText, Calendar } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { QuickActions } from "@/components/dashboard/QuickActions";

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
  status: string;
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
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

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
        supabase.from("calls").select("id, title, scheduled_at, status")
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

      // Fetch recent activities
      const activities = [];
      if (leads.data && leads.data.length > 0) {
        leads.data.slice(0, 3).forEach(lead => {
          activities.push({
            id: lead.id,
            type: "lead",
            description: `New lead: ${lead.name}`,
            time: new Date(lead.created_at).toLocaleString(),
            status: lead.status
          });
        });
      }
      if (deals.data && deals.data.length > 0) {
        deals.data.slice(0, 2).forEach(deal => {
          activities.push({
            id: deal.id,
            type: "deal",
            description: `Deal updated: ${deal.title}`,
            time: new Date(deal.updated_at).toLocaleString(),
            status: deal.stage
          });
        });
      }
      setRecentActivities(activities.sort((a, b) => 
        new Date(b.time).getTime() - new Date(a.time).getTime()
      ).slice(0, 5));
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    {
      label: "Add New Lead",
      icon: Target,
      onClick: () => navigate("/dashboard/leads"),
    },
    {
      label: "Create Customer",
      icon: UserPlus,
      onClick: () => navigate("/dashboard/customers"),
    },
    {
      label: "Schedule Call",
      icon: Phone,
      onClick: () => navigate("/dashboard/calls"),
    },
    {
      label: "New Quotation",
      icon: FileText,
      onClick: () => navigate("/dashboard/quotations"),
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
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background p-6 rounded-lg border">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">Welcome back! Here's your business overview</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Leads"
          value={stats.totalLeads}
          icon={Target}
          trend={{ value: 12, label: "from last month" }}
        />
        <StatCard
          title="Customers"
          value={stats.totalCustomers}
          icon={Users}
          trend={{ value: 8, label: "from last month" }}
        />
        <StatCard
          title="Active Deals"
          value={stats.totalDeals}
          icon={TrendingUp}
          trend={{ value: 15, label: "from last month" }}
        />
        <StatCard
          title="Won Deals"
          value={stats.wonDeals}
          icon={CheckCircle}
          trend={{ value: 20, label: "from last month" }}
        />
        <StatCard
          title="Total Revenue"
          value={`₹${stats.totalRevenue.toLocaleString()}`}
          icon={DollarSign}
          trend={{ value: 25, label: "from last month" }}
        />
        <StatCard
          title="Pending Tasks"
          value={stats.pendingTasks}
          icon={AlertCircle}
          trend={{ value: -5, label: "from last week" }}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <QuickActions actions={quickActions} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Upcoming Meetings & Calls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingCalls.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No upcoming calls scheduled</p>
            ) : (
              upcomingCalls.map((call) => (
                <div key={call.id} className="p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="font-medium text-sm">{call.title}</div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                    <Calendar className="h-3 w-3" />
                    {new Date(call.scheduled_at).toLocaleString()}
                  </div>
                  <div className="text-xs text-primary mt-1 capitalize">{call.status}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <RecentActivity activities={recentActivities} />
      </div>
    </div>
  );
};

export default Dashboard;