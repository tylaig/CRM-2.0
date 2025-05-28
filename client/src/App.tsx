import { Switch, Route } from "wouter";
import Dashboard from "@/pages/Dashboard";
import NotFound from "@/pages/not-found";
import Sales from "@/pages/Sales";
import Losses from "@/pages/Losses";
import Historical from "@/pages/Historical";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import { AuthProvider, useAuth } from "@/components/AuthProvider";

function PrivateRoute({ component: Component, ...rest }: any) {
  const { user } = useAuth();
  if (!user) {
    window.location.href = "/login";
    return null;
  }
  return <Component {...rest} />;
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/" component={() => <PrivateRoute component={Dashboard} />} />
      <Route path="/sales" component={() => <PrivateRoute component={Sales} />} />
      <Route path="/losses" component={() => <PrivateRoute component={Losses} />} />
      <Route path="/historical" component={() => <PrivateRoute component={Historical} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
