interface Props {
    children: React.ReactNode;
};

const Layout = ({ children }: Props) => {
    return (
        <main className="flex min-h-screen max-h-screen">
            {children}
        </main>
    )
}

export default Layout;