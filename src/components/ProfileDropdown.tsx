import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../config/fireBase";
import "../styles/ProfileDropdown.css";
import { useAuth } from "../context/AuthContext";

interface Props {
  open: boolean;
}

export default function ProfileDropdown({ open }: Props) {
  const navigate = useNavigate();

  if (!open) return null;

  const logout = async () => {
    await signOut(auth);
    navigate("/");
  };
  const { user } = useAuth();

  return (
    <div className="profile-dropdown">
      <div className="profile-info">
        <h3>{user?.displayName}</h3>
        <p>{user?.email}</p>
      </div>

      <button onClick={() => navigate("/profile")}>
        <i className="bx bx-user"></i>

        <span>My Profile</span>
      </button>

      <button onClick={() => navigate("/settings")}>
        <i className="bx bx-cog"></i>

        <span>Settings</span>
      </button>

      <button className="logout-btn" onClick={logout}>
        <i className="bx bx-log-out"></i>

        <span>Logout</span>
      </button>
    </div>
  );
}
