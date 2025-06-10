'use server'

const fetchLogin = async (endpoint: string,
    username: string,
    password: string) => {

    const data = new URLSearchParams({
        username,
        password,
        grant_type: 'password',
    });

    console.log("Invio login:", data.toString()); //debug only, to remove
    

    const requestOptions: RequestInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: data.toString(),
    };


    try {
        const response = await fetch(endpoint, requestOptions);

        if (!response.ok) {
            throw new Error(`Error fetching data: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        console.log("Contenuto risposta login:", data); //debug only, to remove
        return data; //access_token
    } catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
}

export default fetchLogin