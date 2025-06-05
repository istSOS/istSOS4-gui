'use server'

const fetchLogin = async (endpoint: string) => {


    const data = new URLSearchParams({
        username: 'admin',
        password: 'admin',
        grant_type: 'password',
    });

    const requestOptions: RequestInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded'},
        body: data.toString(),
    };

    try {
        const response = await fetch(endpoint, requestOptions);
        
        if (!response.ok) {
            throw new Error(`Error fetching data: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
}

export default fetchLogin