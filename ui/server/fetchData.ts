'use server'

const fetchData = async (endpoint: string, token: string) => {

    try {
        const response = await fetch(endpoint, {

            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                
            },
        });

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

export default fetchData