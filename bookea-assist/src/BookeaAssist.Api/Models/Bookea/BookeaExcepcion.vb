Namespace Models.Bookea

    ''' <summary>
    ''' Error de negocio esperado (turno no encontrado, horario no disponible, etc.).
    ''' El motor de conversación captura este tipo de excepción y le devuelve el
    ''' mensaje a Claude como resultado de la herramienta (con is_error = true),
    ''' para que el asistente pueda explicarle la situación al cliente.
    ''' </summary>
    Public Class BookeaExcepcion
        Inherits Exception

        Public Sub New(mensaje As String)
            MyBase.New(mensaje)
        End Sub

    End Class

End Namespace
