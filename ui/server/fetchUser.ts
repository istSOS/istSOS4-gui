import { fetchData } from "../server/api";
const fetchUser = async (token: string, username: string) => {
    try {
        const response = await fetchData(
            `http://api:5000/istsos4/v1.1/Users?$filter=username eq '${username}'`,
            token
        );


        if (!response.ok) {
            throw new Error(`Error fetching user: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        if (!data || !data.value) {
            console.warn("No user data found for username:", username);
            return null;
        }
        return data.value && data.value.length > 0 ? data.value[0] : null;
    } catch (error) {
        console.error("Error fetching user:", error);
        return null;
    }
    
};

export const fetchUserRole = async (token: string, username: string) => {
    const user = await fetchUser(token, username);
    return user?.role || null;
};

export default fetchUser;